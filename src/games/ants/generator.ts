// Генератор уровней муравьёв. Уровни не рисуются руками: картинка + параметры
// сложности + seed → колонки блоков. Решатель отбрасывает нерешаемые.
//
// Как устроено:
// 1. Обводка (с уровня OUTLINE_FROM): внешний слой картинки перекрашивается в цвет,
//    которого в ней нет. Заливка закрыта, пока муравьи не прогрызут обводку, —
//    отсюда и берутся тупики (как тёмный контур в оригинале). Без обводки почти
//    все цвета наших 16×16 картинок снаружи, и тупика не бывает вообще.
// 2. «Луковица»: снимаем картинку слоями снаружи внутрь (слой 0 — доступные сразу
//    пиксели, слой 1 — после слоя 0, …). Это естественный порядок поедания.
// 3. Пиксели каждого цвета выстраиваем в этом порядке и режем на блоки случайного
//    размера [minBlock, maxBlock]. Сумма муравьёв цвета = числу его пикселей.
// 4. Ключ блока = слой его первого пикселя × order + шум. order = 1 — блоки идут
//    в порядке поедания (легко); 0 — вперемешку; < 0 — внутренние всплывают раньше
//    и забивают слоты, нужно искать, что тапнуть (сложно).
// 5. Блоки по ключу раздаются в колонки по кругу (первый — наверх).
// 6. Решатель проверяет уровень; для первых уровней ещё и «тупик невозможен».
//    Не прошёл — следующий seed (детерминированно).
import { mulberry32, randomInt, type Rng } from '../../engine/rng';
import { GAME_COLORS, type GameColorId } from '../../ui/palette';
import { type AntsState, type Block, EMPTY, SLOT_COUNT } from './logic';
import { type Picture, PICTURES } from './pictures';
import { canGetStuck, solve } from './solver';

export interface LevelParams {
  /** Номер картинки в PICTURES. */
  readonly picture: number;
  /** Перекрасить внешний слой в цвет обводки. */
  readonly outline: boolean;
  readonly columns: number;
  readonly minBlock: number;
  readonly maxBlock: number;
  /** Направление порядка: 1 — снаружи внутрь (легко), 0 — вперемешку, < 0 — внутренние раньше. */
  readonly order: number;
  /** Амплитуда шума порядка, в слоях «луковицы». */
  readonly noise: number;
  /** Уровень без возможного тупика (первые уровни). */
  readonly safe: boolean;
}

/** Сколько первых уровней обязаны быть без возможного тупика. */
export const SAFE_LEVELS = 3;
/** С какого уровня картинка получает обводку. */
export const OUTLINE_FROM = 4;
/** Порядок блоков: от ORDER_START на уровне OUTLINE_FROM до ORDER_END на уровне ORDER_END_LEVEL. */
export const ORDER_START = 0.5;
export const ORDER_END = -0.35;
export const ORDER_END_LEVEL = 50;
/** Сколько seed пробуем, прежде чем выдать запасной уровень. */
export const MAX_ATTEMPTS = 30;
/** На сколько смягчается порядок с каждой неудачной попыткой. */
export const ORDER_RELAX = 0.1;
/** Лимит узлов решателя при генерации: дольше — уровень считаем неподходящим. */
export const GENERATOR_MAX_NODES = 1_500;
/** Цвет обводки — первый из списка, которого нет в картинке. */
const OUTLINE_COLORS: readonly GameColorId[] = ['purple', 'blue', 'green', 'red', 'orange', 'pink', 'lightblue', 'yellow'];

/**
 * Кривая сложности по номеру уровня (с 1). Стартуем со средней: ребёнок
 * с помощью проходил ~100 уровней оригинала. Константы — подбирать по игре с сыном.
 */
export function levelParams(level: number): LevelParams {
  const n = Math.max(1, Math.floor(level));
  const progress = Math.min(1, Math.max(0, (n - OUTLINE_FROM) / (ORDER_END_LEVEL - OUTLINE_FROM)));
  return {
    picture: (n - 1) % PICTURES.length,
    outline: n >= OUTLINE_FROM,
    columns: n <= 5 ? 3 : 4,
    // блоки мельче с уровнем: на старте 3–8, к 50-му 1–4
    minBlock: Math.max(1, 3 - Math.floor(n / 20)),
    maxBlock: Math.max(4, 8 - Math.floor(n / 10)),
    order: n < OUTLINE_FROM ? 1 : ORDER_START + (ORDER_END - ORDER_START) * progress,
    noise: 3,
    safe: n <= SAFE_LEVELS,
  };
}

/** Номер слоя «луковицы» для каждого пикселя (EMPTY → −1). */
export function onionLayers(picture: Picture): number[] {
  const { width, height } = picture;
  const pixels = [...picture.pixels];
  const layers = pixels.map(() => -1);
  let layer = 0;
  let left = pixels.filter(cell => cell !== EMPTY).length;
  while (left > 0) {
    const peel: number[] = [];
    for (let index = 0; index < pixels.length; index++) {
      if (pixels[index] === EMPTY) {
        continue;
      }
      const x = index % width;
      const y = (index - x) / width;
      const open =
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        pixels[index - 1] === EMPTY ||
        pixels[index + 1] === EMPTY ||
        pixels[index - width] === EMPTY ||
        pixels[index + width] === EMPTY;
      if (open) {
        peel.push(index);
      }
    }
    for (const index of peel) {
      pixels[index] = EMPTY;
      layers[index] = layer;
    }
    left -= peel.length;
    layer++;
  }
  return layers;
}

interface KeyedBlock {
  readonly block: Block;
  readonly key: number;
}

/** Одна попытка: уровень из картинки и параметров. Решаемость не проверяет. */
export function buildLevel(picture: Picture, params: LevelParams, rng: Rng): AntsState {
  const layers = onionLayers(picture);
  const colors = [...new Set(picture.pixels.filter(cell => cell !== EMPTY))].sort((a, b) => a - b);
  const keyed: KeyedBlock[] = [];
  for (const color of colors) {
    // пиксели цвета в порядке слоёв
    const ordered = picture.pixels
      .map((cell, index) => ({ cell, index }))
      .filter(entry => entry.cell === color)
      .map(entry => layers[entry.index]!)
      .sort((a, b) => a - b);
    let start = 0;
    while (start < ordered.length) {
      const remaining = ordered.length - start;
      let size = Math.min(remaining, randomInt(rng, params.minBlock, params.maxBlock));
      // хвост меньше минимума приклеиваем к этому блоку
      if (remaining - size > 0 && remaining - size < params.minBlock) {
        size = remaining;
      }
      keyed.push({ block: { color, ants: size }, key: ordered[start]! * params.order + rng() * params.noise });
      start += size;
    }
  }
  keyed.sort((a, b) => a.key - b.key);
  const columns: Block[][] = Array.from({ length: params.columns }, () => []);
  keyed.forEach((entry, index) => columns[index % params.columns]!.push(entry.block));
  return {
    width: picture.width,
    height: picture.height,
    pixels: picture.pixels,
    columns,
    slots: Array.from({ length: SLOT_COUNT }, () => null),
  };
}

/** Картинка с обводкой: внешний слой «луковицы» — в цвет, которого в картинке нет. */
export function outlinePicture(picture: Picture): Picture {
  const used = new Set(picture.pixels);
  const id = OUTLINE_COLORS.find(candidate => !used.has(GAME_COLORS.findIndex(color => color.id === candidate)));
  if (!id) {
    return picture;
  }
  const color = GAME_COLORS.findIndex(entry => entry.id === id);
  const layers = onionLayers(picture);
  return { ...picture, pixels: picture.pixels.map((cell, index) => (layers[index] === 0 ? color : cell)) };
}

/** Уровень проходит проверки: решаем, а «безопасный» — ещё и без возможного тупика. */
function acceptable(state: AntsState, params: LevelParams): boolean {
  if (!solve(state, { maxNodes: GENERATOR_MAX_NODES })) {
    return false;
  }
  return !params.safe || !canGetStuck(state);
}

/**
 * Уровень по номеру (с 1) и seed. Детерминированно: тот же (level, seed) → тот же уровень.
 * Нерешаемый вариант отбрасывается, берётся следующий seed, и порядок чуть смягчается
 * (ORDER_RELAX за попытку): картинки с большими внутренними областями (домик) на сильно
 * перевёрнутом порядке почти всегда нерешаемы — так генератор быстро находит
 * самый трудный решаемый вариант, а не перебирает десятки seed.
 */
export function makeLevel(level: number, seed: number): AntsState {
  const params = levelParams(level);
  const source = PICTURES[params.picture]!;
  const picture = params.outline ? outlinePicture(source) : source;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const order = Math.min(1, params.order + attempt * ORDER_RELAX);
    const state = buildLevel(picture, { ...params, order }, mulberry32(seed + attempt * 7919));
    if (acceptable(state, params)) {
      return state;
    }
  }
  // Запасной путь: блоки строго в порядке поедания — так уровень проходим почти всегда.
  // Тесты проверяют, что уровни 1–50 до него не доходят или он решаем.
  return buildLevel(picture, { ...params, order: 1, noise: 0 }, mulberry32(seed));
}

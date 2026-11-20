// Генератор уровней муравьёв. Уровни не рисуются руками: картинка + параметры
// сложности + seed → колонки блоков. Решатель отбрасывает нерешаемые.
//
// Как устроено:
// 1. Обводка (с уровня OUTLINE_FROM): внешний слой картинки перекрашивается в чёрный.
//    Заливка закрыта, пока муравьи не прогрызут обводку, — отсюда и берутся тупики.
//    Без обводки почти все цвета картинки снаружи, и тупика не бывает вообще.
//    Чёрный бывает и внутри (глаза, колёса) — тогда он открывается вместе с обводкой.
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
import { BLACK } from '../../ui/palette';
import { accessibleIndices, type AntsState, type Block, EMPTY, SLOT_COUNT } from './logic';
import { type Picture, PICTURES } from './pictures';
import { canGetStuck, solve } from './solver';

export interface LevelParams {
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

/**
 * Кривая сложности по номеру уровня (с 1). Стартуем со средней: ребёнок
 * с помощью проходил ~100 уровней оригинала. Константы — подбирать по игре с сыном.
 */
export function levelParams(level: number): LevelParams {
  const n = Math.max(1, Math.floor(level));
  const progress = Math.min(1, Math.max(0, (n - OUTLINE_FROM) / (ORDER_END_LEVEL - OUTLINE_FROM)));
  return {
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
    // слой — пиксели, доступные сейчас (по тому же правилу, что у муравьёв: замкнутые дырки не считаются)
    const peel = accessibleIndices(width, height, pixels);
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

/** Картинка с обводкой: внешний слой «луковицы» — чёрный. */
export function outlinePicture(picture: Picture): Picture {
  const layers = onionLayers(picture);
  return { ...picture, pixels: picture.pixels.map((cell, index) => (layers[index] === 0 ? BLACK : cell)) };
}

/** Уровень проходит проверки: решаем, а «безопасный» — ещё и без возможного тупика. */
function acceptable(state: AntsState, params: LevelParams): boolean {
  if (!solve(state, { maxNodes: GENERATOR_MAX_NODES })) {
    return false;
  }
  return !params.safe || !canGetStuck(state);
}

/** Классы размера картинки по большей стороне сетки: 12, 16, 20, 24 клетки. */
export const SIZE_CLASSES = [12, 16, 20, 24] as const;

/** Класс размера картинки (индекс в SIZE_CLASSES): ближайший не меньше большей стороны. */
export function sizeClass(picture: Picture): number {
  const side = Math.max(picture.width, picture.height);
  const index = SIZE_CLASSES.findIndex(size => side <= size);
  return index === -1 ? SIZE_CLASSES.length - 1 : index;
}

/** С какой сложности предпочтительный класс размера растёт на 1 (12 → 16 → 20 → 24). */
export const SIZE_STEP = 12;
/** Разброс классов вокруг предпочтительного: больше — разнообразнее. */
const SIZE_SPREAD = 0.9;

/**
 * Вес класса размера на сложности: чаще маленькие сетки (крупные квадратики) на низкой
 * сложности и мелкие — на высокой, но с разнообразием. Первые SAFE_LEVELS — только 12×12:
 * проверка «тупик невозможен» — полный перебор состояний, на 16×16 он уже ~100 мс на Mac
 * (на iPhone и в CI — вдвое дольше), а на 12×12 — единицы мс. Новичку крупные квадратики и так лучше.
 */
export function sizeWeights(level: number): number[] {
  const target = Math.min(SIZE_CLASSES.length - 1, Math.max(0, (level - 1) / SIZE_STEP));
  return SIZE_CLASSES.map((_, index) =>
    level <= SAFE_LEVELS && index > 0 ? 0 : Math.exp(-((index - target) ** 2) / (2 * SIZE_SPREAD ** 2)),
  );
}

/** Картинки по классам размера; внутри класса — в порядке списка. */
const BY_CLASS: readonly (readonly number[])[] = SIZE_CLASSES.map((_, size) =>
  PICTURES.flatMap((picture, index) => (sizeClass(picture) === size ? [index] : [])),
);

function rawPick(level: number, seed: number): number {
  const rng = mulberry32(Math.floor(seed) * 31 + 17);
  const weights = sizeWeights(level).map((weight, size) => (BY_CLASS[size]!.length > 0 ? weight : 0));
  let roll = rng() * weights.reduce((sum, weight) => sum + weight, 0);
  let size = weights.findIndex(weight => (roll -= weight) < 0);
  if (size === -1) {
    // погрешность округления: последний класс с весом
    size = weights.reduce((last, weight, index) => (weight > 0 ? index : last), 0);
  }
  const pool = BY_CLASS[size]!;
  return pool[Math.floor(rng() * pool.length)]!;
}

/** На сколько seed назад смотрит pickPicture, чтобы картинка не повторилась подряд. */
const PICK_LOOKBACK = 50;

/**
 * Индекс картинки уровня в PICTURES. Детерминированно по (сложность, seed); картинка
 * предыдущего seed подряд не идёт. Цепочка «предыдущих» считается от seed − PICK_LOOKBACK,
 * чтобы не уходить в рекурсию на тысячи уровней. Временное решение: «мешок без повторов»
 * с id картинки в прогрессе — задача карты уровней.
 */
export function pickPicture(level: number, seed: number): number {
  let previous = -1;
  let index = -1;
  for (let current = Math.floor(seed) - PICK_LOOKBACK; current <= seed; current++) {
    index = rawPick(level, current);
    if (index === previous) {
      const pool = BY_CLASS[sizeClass(PICTURES[index]!)]!;
      index = pool.length > 1 ? pool[(pool.indexOf(index) + 1) % pool.length]! : index;
    }
    previous = index;
  }
  return index;
}

/** Блоков на картинку ≈ как у 16×16: на больших картинках блоки крупнее, на маленьких — мельче. */
export const BLOCK_SCALE_PIXELS = 160;

/** Размеры блоков под число пикселей картинки (иначе на 24×24 сотня блоков и решатель не успевает). */
export function scaleBlocks(params: LevelParams, picture: Picture): LevelParams {
  const filled = picture.pixels.filter(cell => cell !== EMPTY).length;
  const factor = Math.min(2.5, Math.max(0.75, filled / BLOCK_SCALE_PIXELS));
  const minBlock = Math.max(1, Math.round(params.minBlock * factor));
  const maxBlock = Math.max(minBlock, Math.round(params.maxBlock * factor));
  return { ...params, minBlock, maxBlock };
}

/**
 * Площадь, до которой проверяем «тупик невозможен» на безопасных уровнях (12×12). makeLevel
 * на них и даёт только 12×12; бо́льшая картинка, заданная явно (makeLevelFor), получает
 * уровень 1 без этой проверки — решаемость проверяется всегда.
 */
const SAFE_CHECK_MAX_CELLS = 144;

/**
 * Уровень по сложности (с 1) и seed. Детерминированно: тот же (level, seed) → тот же уровень.
 * Картинку выбирает pickPicture.
 */
export function makeLevel(level: number, seed: number): AntsState {
  return makeLevelFor(PICTURES[pickPicture(level, seed)]!, level, seed);
}

/**
 * Уровень из заданной картинки. Нерешаемый вариант отбрасывается, берётся следующий seed,
 * и порядок чуть смягчается (ORDER_RELAX за попытку): картинки с большими внутренними
 * областями на сильно перевёрнутом порядке почти всегда нерешаемы — так генератор быстро
 * находит самый трудный решаемый вариант, а не перебирает десятки seed.
 */
export function makeLevelFor(source: Picture, level: number, seed: number): AntsState {
  const base = scaleBlocks(levelParams(level), source);
  const params = { ...base, safe: base.safe && source.width * source.height <= SAFE_CHECK_MAX_CELLS };
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

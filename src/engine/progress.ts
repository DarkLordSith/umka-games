// Прогресс игрока: схема, разбор и миграции. Чистые функции — localStorage трогает
// только оболочка (src/app/storage.ts). Правила — CLAUDE.md → «Прогресс: не ломать».
//
// История схемы:
//   v1 — { v: 1, games: { ants: { level } } }
//   v2 — по каждой игре { difficulty, streak, won, seed }, stickers, settings { sfx, voice }
//   v3 — по каждой игре { difficulty, streak, seed, levels: [{ difficulty, seed, variant }] };
//        won больше не хранится: пройдено = levels.length (одно место правды)
//   v4 — та же форма; stickers дополнены наклейками за уже пройденные уровни
//        (1 пройденный уровень = 1 наклейка, а альбома до v4 не было)
//   v5 — settings.music (фоновая музыка), по умолчанию включена

import type { LevelSpec } from './types';

export const PROGRESS_VERSION = 5;

/** Пройденный уровень: по нему игра строит тот же уровень для переигровки. */
export type LevelRecord = LevelSpec;

export interface GameProgress {
  /** Сложность следующего (ещё не пройденного) уровня. */
  readonly difficulty: number;
  /** Серия адаптивной сложности: > 0 — чистые победы подряд, < 0 — трудные уровни подряд. */
  readonly streak: number;
  /** seed следующего уровня: после перезапуска — тот же уровень. */
  readonly seed: number;
  /** Пройденные уровни по порядку: индекс = номер уровня на карте − 1. */
  readonly levels: readonly LevelRecord[];
}

/** Сколько уровней пройдено; номер текущей точки на карте — на 1 больше. */
export function levelsWon(game: GameProgress): number {
  return game.levels.length;
}

export interface Settings {
  readonly sfx: boolean;
  readonly voice: boolean;
  readonly music: boolean;
}

export interface Progress {
  readonly v: typeof PROGRESS_VERSION;
  /** По id игры; нет записи — игра ещё не начата. */
  readonly games: Readonly<Record<string, GameProgress>>;
  /** Номера полученных наклеек (rewards/stickers.ts) по порядку получения. */
  readonly stickers: readonly number[];
  readonly settings: Settings;
}

export function defaultProgress(): Progress {
  return { v: PROGRESS_VERSION, games: {}, stickers: [], settings: { sfx: true, voice: true, music: true } };
}

/** Прогресс игры или стартовый, если игра ещё не начата. */
export function gameProgress(progress: Progress, id: string, startDifficulty: number): GameProgress {
  return progress.games[id] ?? { difficulty: startDifficulty, streak: 0, seed: 1, levels: [] };
}

export function withGame(progress: Progress, id: string, game: GameProgress): Progress {
  return { ...progress, games: { ...progress.games, [id]: game } };
}

/** Сброс прогресса одной игры (родительский экран): она начнётся заново со своей стартовой сложности. */
export function withoutGame(progress: Progress, id: string): Progress {
  const games = { ...progress.games };
  delete games[id];
  return { ...progress, games };
}

/** Номер следующей наклейки: на 1 больше последней (номера не повторяются). */
export function nextSticker(progress: Progress): number {
  return progress.stickers.length === 0 ? 0 : Math.max(...progress.stickers) + 1;
}

/** Победа — новая наклейка в альбом. */
export function withNewSticker(progress: Progress): Progress {
  return { ...progress, stickers: [...progress.stickers, nextSticker(progress)] };
}

export function withSettings(progress: Progress, settings: Partial<Settings>): Progress {
  return { ...progress, settings: { ...progress.settings, ...settings } };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** Целое ≥ min, иначе запасное значение. */
function int(value: unknown, min: number, fallback: number): number {
  return isInt(value) && value >= min ? value : fallback;
}

/** v1 → v2: уровень муравьёв L становится сложностью L и seed L — тот же самый уровень. */
function v1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const games = isObject(raw.games) ? raw.games : {};
  const ants = isObject(games.ants) ? games.ants : {};
  const level = int(ants.level, 1, 1);
  return {
    v: 2,
    games: { ants: { difficulty: level, streak: 0, won: level - 1, seed: level } },
    stickers: [],
    settings: { sfx: true, voice: true },
  };
}

/** Больше уровней в истории не бывает (защита от битых данных: карта рендерит по списку). */
const MAX_LEVELS = 100_000;

/**
 * Картинки муравьёв v2 по кругу: seed i давал PICTURES[(i − 1) % 10] из этих 10.
 * Нужно только миграции v2 → v3 — восстановить, что сын уже съел.
 */
const V2_ANTS_PICTURES = ['apple', 'fish', 'sun', 'car', 'mushroom', 'strawberry', 'cat', 'house', 'ladybug', 'tree'];

/**
 * v2 → v3: истории уровней не было — восстанавливаем приближённо. Уровень i (1…won):
 * seed i, сложность min(i, текущая), у муравьёв — картинка, которую seed i давал в v2.
 * Главное — номер текущей точки на карте = прежний уровень (won + 1).
 */
function v2ToV3(raw: Record<string, unknown>): Record<string, unknown> {
  const games: Record<string, unknown> = {};
  if (isObject(raw.games)) {
    for (const [id, value] of Object.entries(raw.games)) {
      if (!isObject(value)) {
        continue;
      }
      const difficulty = int(value.difficulty, 1, 1);
      const won = Math.min(MAX_LEVELS, int(value.won, 0, 0));
      const levels = Array.from({ length: won }, (_, index) => ({
        difficulty: Math.min(index + 1, difficulty),
        seed: index + 1,
        variant: id === 'ants' ? V2_ANTS_PICTURES[index % V2_ANTS_PICTURES.length]! : null,
      }));
      games[id] = { difficulty, streak: value.streak, seed: value.seed, levels };
    }
  }
  return { ...raw, v: 3, games };
}

/**
 * v3 → v4: наклейки за уже пройденные уровни — 1 уровень = 1 наклейка. Номера 0…N−1,
 * где N — пройдено во всех играх; уже полученные наклейки сохраняются.
 */
function v3ToV4(raw: Record<string, unknown>): Record<string, unknown> {
  let won = 0;
  if (isObject(raw.games)) {
    for (const game of Object.values(raw.games)) {
      if (isObject(game) && Array.isArray(game.levels)) {
        won += Math.min(MAX_LEVELS, game.levels.length);
      }
    }
  }
  const had = Array.isArray(raw.stickers) ? raw.stickers.filter(item => isInt(item) && item >= 0) : [];
  const backfill = Array.from({ length: won }, (_, index) => index).filter(id => !had.includes(id));
  return { ...raw, v: 4, stickers: [...had, ...backfill] };
}

/** v4 → v5: появилась фоновая музыка — включена. */
function v4ToV5(raw: Record<string, unknown>): Record<string, unknown> {
  const settings = isObject(raw.settings) ? raw.settings : {};
  return { ...raw, v: 5, settings: { ...settings, music: true } };
}

function sanitizeLevel(raw: unknown): LevelRecord | null {
  if (!isObject(raw) || !isInt(raw.seed)) {
    return null;
  }
  return {
    difficulty: int(raw.difficulty, 1, 1),
    seed: raw.seed,
    variant: typeof raw.variant === 'string' ? raw.variant : null,
  };
}

function sanitizeGame(raw: unknown): GameProgress | null {
  if (!isObject(raw)) {
    return null;
  }
  const levels = Array.isArray(raw.levels)
    ? raw.levels
        .slice(0, MAX_LEVELS)
        .map(sanitizeLevel)
        .filter((level): level is LevelRecord => level !== null)
    : [];
  return {
    difficulty: int(raw.difficulty, 1, 1),
    streak: isInt(raw.streak) ? raw.streak : 0,
    seed: isInt(raw.seed) ? raw.seed : 1,
    levels,
  };
}

/** Текущая схема по полям: недостающие — по умолчанию, лишние отбрасываются. */
function sanitize(raw: Record<string, unknown>): Progress {
  const games: Record<string, GameProgress> = {};
  if (isObject(raw.games)) {
    for (const [id, value] of Object.entries(raw.games)) {
      const game = sanitizeGame(value);
      if (game) {
        games[id] = game;
      }
    }
  }
  const stickers = Array.isArray(raw.stickers) ? raw.stickers.filter((item): item is number => isInt(item) && item >= 0) : [];
  const settings = isObject(raw.settings) ? raw.settings : {};
  return {
    v: PROGRESS_VERSION,
    games,
    stickers: [...new Set(stickers)],
    settings: {
      sfx: typeof settings.sfx === 'boolean' ? settings.sfx : true,
      voice: typeof settings.voice === 'boolean' ? settings.voice : true,
      music: typeof settings.music === 'boolean' ? settings.music : true,
    },
  };
}

/** Шаги миграции: ключ — версия, из которой шаг ведёт в следующую. */
const STEPS: Readonly<Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>> = {
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
};

/**
 * Любой сохранённый объект → прогресс текущей версии. Бросает, если это не прогресс
 * вовсе или версия новее нашей (откатиться назад не умеем).
 * Новая версия схемы = новый шаг в STEPS и фикстура в tests/fixtures/.
 */
export function migrate(raw: unknown): Progress {
  if (!isObject(raw)) {
    throw new Error('прогресс — не объект');
  }
  const saved = raw.v;
  if (!isInt(saved) || saved < 1) {
    throw new Error(`неизвестная версия прогресса: ${String(saved)}`);
  }
  if (saved > PROGRESS_VERSION) {
    throw new Error(`прогресс новее приложения: v${saved}`);
  }
  let data = raw;
  let version: number = saved;
  while (version < PROGRESS_VERSION) {
    const step = STEPS[version];
    if (!step) {
      throw new Error(`нет миграции из v${version}`);
    }
    data = step(data);
    version = data.v as number;
  }
  return sanitize(data);
}

export interface ParsedProgress {
  readonly progress: Progress;
  /** Сохранённое значение было, но прочитать его не вышло — оболочка сохранит копию. */
  readonly broken: boolean;
}

/** Текст из хранилища → прогресс. Битый JSON или чужая схема — чистый прогресс без падения. */
export function parseProgress(text: string | null): ParsedProgress {
  if (text === null) {
    return { progress: defaultProgress(), broken: false };
  }
  try {
    return { progress: migrate(JSON.parse(text)), broken: false };
  } catch {
    return { progress: defaultProgress(), broken: true };
  }
}

// Прогресс игрока: схема, разбор и миграции. Чистые функции — localStorage трогает
// только оболочка (src/app/storage.ts). Правила — CLAUDE.md → «Прогресс: не ломать».
//
// История схемы:
//   v1 — { v: 1, games: { ants: { level } } }
//   v2 — по каждой игре { difficulty, streak, won, seed }, stickers, settings { sfx, voice }

export const PROGRESS_VERSION = 2;

export interface GameProgress {
  /** Текущая сложность (число, по которому игра строит уровень). */
  readonly difficulty: number;
  /** Серия адаптивной сложности: > 0 — чистые победы подряд, < 0 — трудные уровни подряд. */
  readonly streak: number;
  /** Сколько уровней пройдено всего. */
  readonly won: number;
  /** seed текущего (ещё не пройденного) уровня: после перезапуска — тот же уровень. */
  readonly seed: number;
}

export interface Settings {
  readonly sfx: boolean;
  readonly voice: boolean;
}

export interface Progress {
  readonly v: typeof PROGRESS_VERSION;
  /** По id игры; нет записи — игра ещё не начата. */
  readonly games: Readonly<Record<string, GameProgress>>;
  /** Номера полученных наклеек (задача rewards). */
  readonly stickers: readonly number[];
  readonly settings: Settings;
}

export function defaultProgress(): Progress {
  return { v: PROGRESS_VERSION, games: {}, stickers: [], settings: { sfx: true, voice: true } };
}

/** Прогресс игры или стартовый, если игра ещё не начата. */
export function gameProgress(progress: Progress, id: string, startDifficulty: number): GameProgress {
  return progress.games[id] ?? { difficulty: startDifficulty, streak: 0, won: 0, seed: 1 };
}

export function withGame(progress: Progress, id: string, game: GameProgress): Progress {
  return { ...progress, games: { ...progress.games, [id]: game } };
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

function sanitizeGame(raw: unknown): GameProgress | null {
  if (!isObject(raw)) {
    return null;
  }
  return {
    difficulty: int(raw.difficulty, 1, 1),
    streak: isInt(raw.streak) ? raw.streak : 0,
    won: int(raw.won, 0, 0),
    seed: isInt(raw.seed) ? raw.seed : 1,
  };
}

/** v2 по полям: недостающие — по умолчанию, лишние отбрасываются. */
function sanitizeV2(raw: Record<string, unknown>): Progress {
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
    },
  };
}

/** Шаги миграции: ключ — версия, из которой шаг ведёт в следующую. */
const STEPS: Readonly<Record<number, (raw: Record<string, unknown>) => Record<string, unknown>>> = {
  1: v1ToV2,
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
  return sanitizeV2(data);
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

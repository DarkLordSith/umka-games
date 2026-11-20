// Прогресс игрока: схема, разбор и миграции. Чистые функции — localStorage трогает
// только оболочка (src/app/storage.ts). Правила — CLAUDE.md → «Прогресс: не ломать».

export const PROGRESS_VERSION = 1;

export interface AntsProgress {
  /** Номер текущего (ещё не пройденного) уровня, с 1. */
  readonly level: number;
}

export interface Progress {
  readonly v: typeof PROGRESS_VERSION;
  readonly games: {
    readonly ants: AntsProgress;
  };
}

export function defaultProgress(): Progress {
  return { v: PROGRESS_VERSION, games: { ants: { level: 1 } } };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Целое ≥ 1, иначе запасное значение. */
function level(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback;
}

/**
 * Любой сохранённый объект → прогресс текущей версии. Недостающие поля —
 * значения по умолчанию, лишние отбрасываются. Бросает, если это не прогресс
 * вовсе или версия новее нашей (откатиться назад не умеем).
 * Новая версия схемы = новый шаг здесь (v1 → v2 → …) и фикстура в tests/fixtures/.
 */
export function migrate(raw: unknown): Progress {
  if (!isObject(raw)) {
    throw new Error('прогресс — не объект');
  }
  const version = raw.v;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(`неизвестная версия прогресса: ${String(version)}`);
  }
  if (version > PROGRESS_VERSION) {
    throw new Error(`прогресс новее приложения: v${version}`);
  }
  const games = isObject(raw.games) ? raw.games : {};
  const ants = isObject(games.ants) ? games.ants : {};
  return { v: PROGRESS_VERSION, games: { ants: { level: level(ants.level, 1) } } };
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

export function withAntsLevel(progress: Progress, next: number): Progress {
  return { ...progress, games: { ...progress.games, ants: { ...progress.games.ants, level: next } } };
}

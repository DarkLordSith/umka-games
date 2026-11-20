// Адаптивная сложность. Игры о ней не знают: они только строят уровень по числу.

/** Столько «чистых» побед подряд (без подсказки и тупика) → сложность +1. Решение 20.11: каждая. */
export const UP_AFTER_CLEAN = 1;
/** Столько уровней подряд с подсказкой или тупиком → сложность −1. */
export const DOWN_AFTER_STRUGGLE = 2;

export interface DifficultyState {
  readonly difficulty: number;
  /** Серия: > 0 — чистые победы подряд, < 0 — трудные уровни подряд. */
  readonly streak: number;
}

/** Итог уровня → новая сложность и серия. Ниже minDifficulty не опускается. */
export function nextDifficulty(current: DifficultyState, clean: boolean, minDifficulty: number): DifficultyState {
  if (clean) {
    const streak = Math.max(current.streak, 0) + 1;
    return streak >= UP_AFTER_CLEAN
      ? { difficulty: current.difficulty + 1, streak: 0 }
      : { difficulty: current.difficulty, streak };
  }
  const streak = Math.min(current.streak, 0) - 1;
  return streak <= -DOWN_AFTER_STRUGGLE
    ? { difficulty: Math.max(minDifficulty, current.difficulty - 1), streak: 0 }
    : { difficulty: Math.max(minDifficulty, current.difficulty), streak };
}

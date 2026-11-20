import { describe, expect, it } from 'vitest';
import { DOWN_AFTER_STRUGGLE, nextDifficulty, UP_AFTER_CLEAN } from '../../src/engine/difficulty';

describe('адаптивная сложность', () => {
  it('каждая чистая победа → +1, серия не копится', () => {
    expect(UP_AFTER_CLEAN).toBe(1);
    let state = { difficulty: 5, streak: 0 };
    state = nextDifficulty(state, true, 1);
    expect(state).toEqual({ difficulty: 6, streak: 0 });
    expect(nextDifficulty(state, true, 1)).toEqual({ difficulty: 7, streak: 0 });
  });

  it(`${DOWN_AFTER_STRUGGLE} трудных уровня подряд → −1`, () => {
    const once = nextDifficulty({ difficulty: 5, streak: 0 }, false, 1);
    expect(once).toEqual({ difficulty: 5, streak: -1 });
    expect(nextDifficulty(once, false, 1)).toEqual({ difficulty: 4, streak: 0 });
  });

  it('трудный уровень сбрасывает счётчик чистых, чистый — счётчик трудных', () => {
    expect(nextDifficulty({ difficulty: 5, streak: 2 }, false, 1)).toEqual({ difficulty: 5, streak: -1 });
    // после одного трудного чистая победа сразу даёт +1 и обнуляет счётчик трудных
    expect(nextDifficulty({ difficulty: 5, streak: -1 }, true, 1)).toEqual({ difficulty: 6, streak: 0 });
    // трудный → чистый → трудный: снова только −1 в серии, не −2
    const mixed = nextDifficulty(nextDifficulty({ difficulty: 5, streak: -1 }, true, 1), false, 1);
    expect(mixed).toEqual({ difficulty: 6, streak: -1 });
  });

  it('не ниже минимума', () => {
    expect(nextDifficulty({ difficulty: 1, streak: -1 }, false, 1)).toEqual({ difficulty: 1, streak: 0 });
    expect(nextDifficulty({ difficulty: 3, streak: -1 }, false, 3)).toEqual({ difficulty: 3, streak: 0 });
  });
});

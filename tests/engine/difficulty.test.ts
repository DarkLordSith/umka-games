import { describe, expect, it } from 'vitest';
import { DOWN_AFTER_STRUGGLE, nextDifficulty, UP_AFTER_CLEAN } from '../../src/engine/difficulty';

describe('адаптивная сложность', () => {
  it(`${UP_AFTER_CLEAN} чистые победы подряд → +1, серия сбрасывается`, () => {
    let state = { difficulty: 5, streak: 0 };
    for (let i = 1; i < UP_AFTER_CLEAN; i++) {
      state = nextDifficulty(state, true, 1);
      expect(state).toEqual({ difficulty: 5, streak: i });
    }
    expect(nextDifficulty(state, true, 1)).toEqual({ difficulty: 6, streak: 0 });
  });

  it(`${DOWN_AFTER_STRUGGLE} трудных уровня подряд → −1`, () => {
    const once = nextDifficulty({ difficulty: 5, streak: 0 }, false, 1);
    expect(once).toEqual({ difficulty: 5, streak: -1 });
    expect(nextDifficulty(once, false, 1)).toEqual({ difficulty: 4, streak: 0 });
  });

  it('трудный уровень обрывает серию чистых, чистый — серию трудных', () => {
    expect(nextDifficulty({ difficulty: 5, streak: 2 }, false, 1)).toEqual({ difficulty: 5, streak: -1 });
    expect(nextDifficulty({ difficulty: 5, streak: -1 }, true, 1)).toEqual({ difficulty: 5, streak: 1 });
  });

  it('не ниже минимума', () => {
    expect(nextDifficulty({ difficulty: 1, streak: -1 }, false, 1)).toEqual({ difficulty: 1, streak: 0 });
    expect(nextDifficulty({ difficulty: 3, streak: -1 }, false, 3)).toEqual({ difficulty: 3, streak: 0 });
  });
});

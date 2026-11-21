import { describe, expect, it } from 'vitest';
import { type CollectionRules, collectionCounts, stickerReward } from '../../src/engine/collection';
import type { LevelSpec } from '../../src/engine/types';

const rules: CollectionRules = {
  variants: ['apple', 'cat', 'sun'],
  // как у муравьёв: пропавший вариант — выбор по seed
  variantOf: level => (level.variant !== null && ['apple', 'cat', 'sun'].includes(level.variant) ? level.variant : 'sun'),
};
const level = (seed: number, variant: string | null): LevelSpec => ({ difficulty: 1, seed, variant });

describe('коллекция наклеек', () => {
  it('выводится из пройденных уровней: вариант → сколько раз пройден', () => {
    const counts = collectionCounts(rules, [level(1, 'apple'), level(2, 'cat'), level(3, 'apple')]);
    expect([...counts]).toEqual([
      ['apple', 2],
      ['cat', 1],
    ]);
    expect(collectionCounts(rules, []).size).toBe(0);
  });

  it('пропавший вариант считается картинкой, которую уровень показал', () => {
    expect(collectionCounts(rules, [level(1, 'gone'), level(2, null)]).get('sun')).toBe(2);
  });

  it('неизвестные игре варианты не попадают в коллекцию', () => {
    const odd: CollectionRules = { variants: ['apple'], variantOf: spec => spec.variant };
    expect([...collectionCounts(odd, [level(1, 'zzz'), level(2, null), level(3, 'apple')])]).toEqual([['apple', 1]]);
    expect(stickerReward(odd, [], level(1, 'zzz'))).toBeNull();
  });

  it('новая картинка — новая наклейка, повтор — нет', () => {
    const before = [level(1, 'apple')];
    expect(stickerReward(rules, before, level(2, 'cat'))).toEqual({ variant: 'cat', isNew: true });
    expect(stickerReward(rules, before, level(2, 'apple'))).toEqual({ variant: 'apple', isNew: false });
    expect(stickerReward(rules, [], level(1, 'apple'))).toEqual({ variant: 'apple', isNew: true });
  });

  it('переигровка: уровень уже среди пройденных — повтор, новой наклейки нет', () => {
    const levels = [level(1, 'apple'), level(2, 'cat')];
    expect(stickerReward(rules, levels, levels[1]!)).toEqual({ variant: 'cat', isNew: false });
    // и коллекция не меняется: прогресс переигровка не трогает
    expect(collectionCounts(rules, levels).get('cat')).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randomInt, shuffle } from '../../src/engine/rng';

describe('rng', () => {
  it('тот же seed — та же последовательность, другой — другая', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const c = mulberry32(8);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
  });

  it('числа в [0, 1)', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('randomInt — включительно с обеих сторон, все значения встречаются', () => {
    const rng = mulberry32(2);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const value = randomInt(rng, 3, 6);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('shuffle — перестановка, исходник не меняется', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(mulberry32(3), items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...result].sort()).toEqual(items);
  });

  it('pick берёт элемент массива, на пустом бросает', () => {
    expect(['a', 'b']).toContain(pick(mulberry32(4), ['a', 'b']));
    expect(() => pick(mulberry32(4), [])).toThrow();
  });
});

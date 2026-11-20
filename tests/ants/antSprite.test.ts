import { describe, expect, it } from 'vitest';
import { DIRECTIONS, directionOf, FRAMES, WALK_CYCLE } from '../../src/games/ants/antSprite';

describe('спрайт муравья', () => {
  it('направление по участку пути — только 4 оси', () => {
    expect(directionOf(5, 0)).toBe('right');
    expect(directionOf(-5, 0)).toBe('left');
    expect(directionOf(0, 5)).toBe('down');
    expect(directionOf(0, -5)).toBe('up');
  });

  it('цикл шага использует только заготовленные кадры', () => {
    expect(DIRECTIONS).toHaveLength(4);
    expect(WALK_CYCLE.every(frame => frame >= 0 && frame < FRAMES)).toBe(true);
    expect(new Set(WALK_CYCLE).size).toBe(FRAMES);
  });
});

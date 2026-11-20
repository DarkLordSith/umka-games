import { describe, expect, it } from 'vitest';
import { EMPTY } from '../../src/games/ants/logic';
import { parsePicture, PICTURE_SOURCES, PICTURES } from '../../src/games/ants/pictures';

describe('картинки', () => {
  it('10 сюжетов из задачи', () => {
    expect(PICTURES.map(picture => picture.id).sort()).toEqual(
      ['apple', 'car', 'cat', 'fish', 'house', 'ladybug', 'mushroom', 'strawberry', 'sun', 'tree'].sort(),
    );
  });

  it.each(PICTURES.map(picture => [picture.id, picture] as const))('%s: 16×16, 2–5 цветов, фон пустой', (_id, picture) => {
    expect(picture.width).toBe(16);
    expect(picture.height).toBe(16);
    expect(picture.pixels).toHaveLength(256);
    const colors = new Set(picture.pixels.filter(cell => cell !== EMPTY));
    expect(colors.size).toBeGreaterThanOrEqual(2);
    expect(colors.size).toBeLessThanOrEqual(5);
    expect(picture.pixels).toContain(EMPTY);
  });

  it('строки ровные, буквы известные — иначе parsePicture бросает', () => {
    expect(PICTURE_SOURCES.every(source => source.rows.every(row => row.length === 16))).toBe(true);
    expect(() => parsePicture({ id: 'x', rows: ['RR', 'R'] })).toThrow();
    expect(() => parsePicture({ id: 'x', rows: ['RZ'] })).toThrow();
  });
});

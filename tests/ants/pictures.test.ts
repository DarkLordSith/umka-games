import { describe, expect, it } from 'vitest';
import { EMPTY } from '../../src/games/ants/logic';
import { parsePicture, PICTURE_SOURCES, PICTURES } from '../../src/games/ants/pictures';
import { c, r, rasterize } from '../../src/games/ants/shapes';
import { BLACK, GAME_COLORS } from '../../src/ui/palette';

/** Допустимые стороны сетки. */
const SIDES = [12, 16, 18, 20, 24];

describe('картинки', () => {
  it('не меньше 50, id уникальны', () => {
    expect(PICTURES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(PICTURES.map(picture => picture.id)).size).toBe(PICTURES.length);
  });

  it.each(PICTURES.map(picture => [picture.id, picture] as const))(
    '%s: сетка 12…24, 2–5 цветов + чёрный, фон пустой',
    (_id, picture) => {
      expect(SIDES).toContain(picture.width);
      expect(SIDES).toContain(picture.height);
      expect(picture.pixels).toHaveLength(picture.width * picture.height);
      expect(picture.pixels.every(cell => cell === EMPTY || (cell >= 0 && cell < GAME_COLORS.length))).toBe(true);
      const colors = new Set(picture.pixels.filter(cell => cell !== EMPTY));
      expect(colors.size).toBeGreaterThanOrEqual(2);
      colors.delete(BLACK);
      expect(colors.size).toBeLessThanOrEqual(5);
      expect(picture.pixels).toContain(EMPTY);
    },
  );

  it('размеры примерно поровну: в каждом классе 12/16/20/24 не меньше 8 картинок', () => {
    const counts = new Map<number, number>();
    for (const picture of PICTURES) {
      const side = SIDES.filter(size => size !== 18).find(size => Math.max(picture.width, picture.height) <= size)!;
      counts.set(side, (counts.get(side) ?? 0) + 1);
    }
    for (const side of [12, 16, 20, 24]) {
      expect(counts.get(side) ?? 0, `${side}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('строки ровные, буквы известные — иначе parsePicture бросает', () => {
    expect(PICTURE_SOURCES.every(source => source.rows.every(row => row.length === source.rows[0]!.length))).toBe(true);
    expect(() => parsePicture({ id: 'x', rows: ['RR', 'R'] })).toThrow();
    expect(() => parsePicture({ id: 'x', rows: ['RZ'] })).toThrow();
    expect(parsePicture({ id: 'x', rows: ['X.'] }).pixels).toEqual([BLACK, EMPTY]);
  });
});

describe('картинки из фигур', () => {
  it('клетка закрашена, если центр внутри; строчная — только поверх, точка — стирает', () => {
    const rows = rasterize({
      id: 't',
      width: 4,
      height: 2,
      shapes: [r('R', 0, 0, 2, 2), r('b', 1, 0, 3, 1), c('.', 0.5, 1.5, 0.4)],
    });
    expect(rows).toEqual(['RB..', '.R..']);
  });
});

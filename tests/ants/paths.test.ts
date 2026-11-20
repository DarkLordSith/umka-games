import { describe, expect, it } from 'vitest';
import { corners, gridPath } from '../../src/games/ants/paths';

// 3×3, занята середина и вся правая колонка
const blockedCells = new Set([4, 2, 5, 8]);
const blocked = (index: number) => blockedCells.has(index);

describe('путь муравья', () => {
  it('только соседние клетки по горизонтали/вертикали, не сквозь занятые', () => {
    const path = gridPath(3, 3, blocked, { x: 1, y: 3 }, { x: 2, y: 1 })!;
    expect(path[0]).toEqual({ x: 1, y: 3 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 1 });
    path.slice(1).forEach((cell, index) => {
      const prev = path[index]!;
      expect(Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y)).toBe(1);
    });
    // кроме самой цели — ни одной занятой клетки картинки
    const inside = path.slice(0, -1).filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < 3 && cell.y < 3);
    expect(inside.every(cell => !blocked(cell.y * 3 + cell.x))).toBe(true);
  });

  it('обходит картинку по полю', () => {
    const full = () => true;
    const path = gridPath(3, 3, full, { x: 1, y: 3 }, { x: 1, y: 0 })!;
    // цель сверху, внутрь нельзя — путь идёт по полю вокруг
    expect(path.some(cell => cell.y === -1)).toBe(true);
    expect(path.slice(0, -1).every(cell => cell.x < 0 || cell.y < 0 || cell.x > 2 || cell.y > 2)).toBe(true);
  });

  it('нет пути — null', () => {
    // цель (1,1) за стеной, а поле отрезано: картинка 3×3 без поля не бывает, поэтому цель вне сетки
    expect(gridPath(3, 3, blocked, { x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull();
  });

  it('corners оставляет только повороты', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ];
    expect(corners(points)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
  });
});

// Путь муравья по сетке картинки: только по горизонтали и вертикали,
// по пустым клеткам и полю в 1 клетку вокруг картинки, не сквозь несъеденные пиксели.
// Так муравьи сами бегут по краю картинки, как в правилах механики.

export interface Cell {
  /** Столбец, от −1 (поле слева) до width (поле справа). */
  readonly x: number;
  /** Строка, от −1 (поле сверху) до height (поле снизу). */
  readonly y: number;
}

const STEPS: readonly Cell[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * Кратчайший путь из from в to поиском в ширину. blocked(index) — занята ли клетка
 * картинки (индекс построчно). Клетки поля и сама цель to проходимы всегда.
 * Возвращает клетки от from до to включительно или null, если пути нет.
 */
export function gridPath(
  width: number,
  height: number,
  blocked: (index: number) => boolean,
  from: Cell,
  to: Cell,
): Cell[] | null {
  const W = width + 2;
  const H = height + 2;
  const id = (cell: Cell) => (cell.y + 1) * W + (cell.x + 1);
  const passable = (cell: Cell) => {
    if (cell.x < -1 || cell.y < -1 || cell.x > width || cell.y > height) {
      return false;
    }
    if (cell.x === to.x && cell.y === to.y) {
      return true;
    }
    const inside = cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
    return !inside || !blocked(cell.y * width + cell.x);
  };
  const previous = new Int32Array(W * H).fill(-2);
  const start = id(from);
  previous[start] = -1;
  const queue: Cell[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    if (cell.x === to.x && cell.y === to.y) {
      const path: Cell[] = [];
      for (let at = id(cell); at !== -1; at = previous[at]!) {
        path.push({ x: (at % W) - 1, y: Math.floor(at / W) - 1 });
      }
      return path.reverse();
    }
    for (const step of STEPS) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      if (passable(next) && previous[id(next)] === -2) {
        previous[id(next)] = id(cell);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Убрать промежуточные точки на прямых участках: остаются только повороты. */
export function corners<T extends { x: number; y: number }>(points: readonly T[]): T[] {
  const result: T[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && last.x === point.x && last.y === point.y) {
      continue;
    }
    const before = result[result.length - 2];
    if (last && before && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))) {
      result[result.length - 1] = point;
    } else {
      result.push(point);
    }
  }
  return result;
}

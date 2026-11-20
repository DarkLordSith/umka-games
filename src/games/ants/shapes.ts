// Картинки из фигур: круги, эллипсы, прямоугольники, многоугольники, линии и звёзды
// в координатах клеток сетки. Растеризуются при загрузке (клетка закрашена, если её
// центр внутри фигуры). Так проще рисовать крупные сетки (20×20, 24×24), чем строками.
//
// Цвет — буква как в строковых картинках (pictures.ts), фигуры рисуются по порядку:
//   заглавная (R) — красит клетку;
//   строчная (r)  — красит только уже закрашенные клетки (полоски, пятна поверх тела);
//   '.'           — стирает (дырки, вырезы).

export type Shape =
  | readonly ['c', string, number, number, number]
  | readonly ['e', string, number, number, number, number]
  | readonly ['r', string, number, number, number, number]
  | readonly ['p', string, readonly number[]]
  | readonly ['l', string, number, number, number, number, number]
  | readonly ['s', string, number, number, number, number];

/** Круг: центр и радиус. */
export const c = (color: string, cx: number, cy: number, r: number): Shape => ['c', color, cx, cy, r];
/** Эллипс: центр и полуоси. */
export const e = (color: string, cx: number, cy: number, rx: number, ry: number): Shape => ['e', color, cx, cy, rx, ry];
/** Прямоугольник: левый верхний угол, ширина, высота (в клетках). */
export const r = (color: string, x: number, y: number, w: number, h: number): Shape => ['r', color, x, y, w, h];
/** Многоугольник: x1, y1, x2, y2, … */
export const p = (color: string, ...points: number[]): Shape => ['p', color, points];
/** Линия-«колбаска»: от (x1, y1) до (x2, y2), полутолщина `half`. */
export const l = (color: string, x1: number, y1: number, x2: number, y2: number, half: number): Shape => [
  'l',
  color,
  x1,
  y1,
  x2,
  y2,
  half,
];
/** Пятиконечная звезда: центр, внешний и внутренний радиус. */
export const s = (color: string, cx: number, cy: number, outer: number, inner: number): Shape => [
  's',
  color,
  cx,
  cy,
  outer,
  inner,
];

export interface ShapeSource {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly Shape[];
}

function insidePolygon(points: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i]!;
    const yi = points[i + 1]!;
    const xj = points[j]!;
    const yj = points[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function starPoints(cx: number, cy: number, outer: number, inner: number): number[] {
  const points: number[] = [];
  for (let k = 0; k < 10; k++) {
    const radius = k % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (k * Math.PI) / 5;
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  return points;
}

function segmentDistance(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function covers(shape: Shape, x: number, y: number): boolean {
  switch (shape[0]) {
    case 'c':
      return Math.hypot(x - shape[2], y - shape[3]) <= shape[4];
    case 'e':
      return ((x - shape[2]) / shape[4]) ** 2 + ((y - shape[3]) / shape[5]) ** 2 <= 1;
    case 'r':
      return x >= shape[2] && x <= shape[2] + shape[4] && y >= shape[3] && y <= shape[3] + shape[5];
    case 'p':
      return insidePolygon(shape[2], x, y);
    case 'l':
      return segmentDistance(x, y, shape[2], shape[3], shape[4], shape[5]) <= shape[6];
    case 's':
      return insidePolygon(starPoints(shape[2], shape[3], shape[4], shape[5]), x, y);
  }
}

/** Фигуры → строки символов ('.' — пусто), тот же формат, что у строковых картинок. */
export function rasterize(source: ShapeSource): string[] {
  const grid: string[][] = Array.from({ length: source.height }, () => Array<string>(source.width).fill('.'));
  for (const shape of source.shapes) {
    const color = shape[1];
    const overOnly = color !== '.' && color === color.toLowerCase();
    const paint = color === '.' ? '.' : color.toUpperCase();
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (overOnly && grid[y]![x] === '.') {
          continue;
        }
        if (covers(shape, x + 0.5, y + 0.5)) {
          grid[y]![x] = paint;
        }
      }
    }
  }
  return grid.map(row => row.join(''));
}

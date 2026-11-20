// Наклейки альбома: 1 пройденный уровень = 1 наклейка. Рисуются кодом из простых фигур
// (viewBox 0…100), свои. Детерминированно: номер наклейки → дизайн и цветовой вариант.
//
// Номер n → дизайн n % D, вариант ⌊n / D⌋ % VARIANTS. Первые D наклеек — все разные
// картинки, дальше те же картинки в другой раскраске (игровые цвета сдвигаются по кругу).
// Всего различимых: D × VARIANTS (≥ 60, сейчас 148); дальше круг повторяется.
//
// Цвет части — id игрового цвета из палитры, 'white' или 'ink'. Чёрный, белый и ink
// при смене варианта не меняются (глаза, колёса, контуры).
import type { GameColorId } from '../ui/palette';

export type StickerColor = GameColorId | 'white' | 'ink';

export type StickerPart =
  | { readonly kind: 'circle'; readonly color: StickerColor; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly kind: 'ellipse';
      readonly color: StickerColor;
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
      readonly rotate?: number;
    }
  | {
      readonly kind: 'rect';
      readonly color: StickerColor;
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly r?: number;
    }
  | { readonly kind: 'path'; readonly color: StickerColor; readonly d: string }
  /** Только линия (стебель, луч радуги, нитка шарика): цвет — цвет линии. */
  | { readonly kind: 'line'; readonly color: StickerColor; readonly d: string; readonly width: number };

export interface StickerDesign {
  readonly id: string;
  readonly parts: readonly StickerPart[];
}

const c = (color: StickerColor, cx: number, cy: number, r: number): StickerPart => ({ kind: 'circle', color, cx, cy, r });
const e = (color: StickerColor, cx: number, cy: number, rx: number, ry: number, rotate?: number): StickerPart => ({
  kind: 'ellipse',
  color,
  cx,
  cy,
  rx,
  ry,
  rotate,
});
const r = (color: StickerColor, x: number, y: number, w: number, h: number, radius?: number): StickerPart => ({
  kind: 'rect',
  color,
  x,
  y,
  w,
  h,
  r: radius,
});
const p = (color: StickerColor, d: string): StickerPart => ({ kind: 'path', color, d });
const l = (color: StickerColor, d: string, width: number): StickerPart => ({ kind: 'line', color, d, width });

/** Пятиконечная звезда как путь. */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, k) => {
    const radius = k % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (k * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return `M ${points.join(' L ')} Z`;
}

/** Пара глаз: белок и зрачок. */
const eyes = (y: number, left: number, right: number, size = 7): StickerPart[] => [
  c('white', left, y, size),
  c('white', right, y, size),
  c('ink', left + 1, y + 1, size * 0.5),
  c('ink', right + 1, y + 1, size * 0.5),
];

export const STICKER_DESIGNS: readonly StickerDesign[] = [
  { id: 'star', parts: [p('yellow', star(50, 53, 40, 17)), c('pink', 38, 58, 4), c('pink', 62, 58, 4), c('ink', 43, 50, 3), c('ink', 57, 50, 3)] },
  { id: 'heart', parts: [p('red', 'M50 85 C10 60 12 25 32 22 C42 20 48 28 50 34 C52 28 58 20 68 22 C88 25 90 60 50 85 Z'), e('white', 34, 36, 6, 4, -30)] },
  { id: 'apple', parts: [l('ink', 'M50 30 Q50 20 55 14', 5), e('green', 64, 18, 11, 6, -25), p('red', 'M50 30 C30 18 12 34 16 56 C20 80 38 90 50 84 C62 90 80 80 84 56 C88 34 70 18 50 30 Z'), e('white', 32, 46, 5, 8, 20)] },
  { id: 'cherry', parts: [l('green', 'M32 62 Q40 30 58 16', 5), l('green', 'M68 64 Q62 36 58 16', 5), e('green', 70, 20, 12, 6, 20), c('red', 32, 66, 17), c('red', 68, 68, 17), c('white', 26, 60, 4), c('white', 62, 62, 4)] },
  { id: 'strawberry', parts: [p('red', 'M50 90 C30 80 14 50 22 34 C32 22 68 22 78 34 C86 50 70 80 50 90 Z'), p('green', 'M30 30 L40 16 L50 26 L60 16 L70 30 L50 36 Z'), c('yellow', 38, 48, 2.5), c('yellow', 56, 46, 2.5), c('yellow', 46, 62, 2.5), c('yellow', 62, 62, 2.5), c('yellow', 50, 76, 2.5)] },
  { id: 'pear', parts: [l('ink', 'M50 28 L52 12', 5), e('green', 62, 16, 10, 5, -20), p('yellow', 'M50 24 C38 24 38 44 32 52 C20 68 28 90 50 90 C72 90 80 68 68 52 C62 44 62 24 50 24 Z'), e('white', 40, 62, 4, 8, 15)] },
  { id: 'banana', parts: [p('yellow', 'M18 30 C20 70 60 88 86 64 C82 60 78 60 74 62 C56 74 34 62 30 30 Z'), r('ink', 14, 24, 8, 9, 3), c('ink', 85, 63, 3)] },
  { id: 'carrot', parts: [e('green', 40, 20, 6, 14, -20), e('green', 52, 16, 6, 14), e('green', 64, 20, 6, 14, 20), p('orange', 'M30 34 L70 34 C70 50 58 78 50 90 C42 78 30 50 30 34 Z'), l('ink', 'M38 48 L46 48', 3), l('ink', 'M54 62 L62 62', 3)] },
  { id: 'mushroom', parts: [r('white', 38, 50, 24, 36, 10), p('red', 'M12 56 C12 26 88 26 88 56 Z'), c('white', 32, 42, 6), c('white', 56, 36, 7), c('white', 74, 48, 5)] },
  { id: 'flower', parts: [l('green', 'M50 58 L50 92', 6), e('green', 62, 80, 10, 5, -30), c('pink', 50, 22, 13), c('pink', 72, 38, 13), c('pink', 64, 62, 13), c('pink', 36, 62, 13), c('pink', 28, 38, 13), c('yellow', 50, 42, 12)] },
  { id: 'sun', parts: [...Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return p('orange', `M${50 + 30 * Math.cos(a - 0.25)} ${50 + 30 * Math.sin(a - 0.25)} L${50 + 44 * Math.cos(a)} ${50 + 44 * Math.sin(a)} L${50 + 30 * Math.cos(a + 0.25)} ${50 + 30 * Math.sin(a + 0.25)} Z`); }), c('yellow', 50, 50, 26), ...eyes(46, 41, 59, 4), l('ink', 'M42 58 Q50 64 58 58', 3)] },
  { id: 'moon', parts: [p('yellow', 'M62 12 C30 14 14 46 26 70 C38 92 70 94 86 74 C60 78 40 56 48 34 C52 22 58 16 62 12 Z'), c('ink', 38, 52, 3), p('orange', star(76, 24, 10, 4))] },
  { id: 'cloud', parts: [c('white', 32, 56, 18), c('white', 52, 44, 22), c('white', 72, 56, 16), r('white', 28, 56, 46, 18, 9), e('lightblue', 50, 74, 22, 4), ...eyes(56, 44, 60, 3.5)] },
  { id: 'rainbow', parts: [l('red', 'M14 76 A36 36 0 0 1 86 76', 9), l('yellow', 'M23 76 A27 27 0 0 1 77 76', 9), l('green', 'M32 76 A18 18 0 0 1 68 76', 9), c('white', 16, 78, 9), c('white', 84, 78, 9)] },
  { id: 'balloon', parts: [l('ink', 'M50 72 Q44 82 52 94', 3), e('blue', 50, 42, 28, 32), p('blue', 'M45 74 L55 74 L50 80 Z'), e('white', 38, 30, 6, 10, 20)] },
  { id: 'ball', parts: [c('yellow', 50, 50, 36), p('blue', 'M15 42 C35 36 65 36 85 42 L86 58 C65 52 35 52 14 58 Z'), p('red', 'M26 22 C40 18 60 18 74 22 C66 14 34 14 26 22 Z'), c('white', 36, 30, 5)] },
  { id: 'car', parts: [p('red', 'M10 66 L10 50 C10 46 14 44 20 44 L30 44 L38 28 L66 28 L76 44 L86 46 C90 48 90 52 90 66 Z'), p('lightblue', 'M42 34 L50 34 L50 44 L36 44 Z'), p('lightblue', 'M56 34 L64 34 L70 44 L56 44 Z'), c('ink', 30, 68, 11), c('ink', 70, 68, 11), c('white', 30, 68, 4), c('white', 70, 68, 4)] },
  { id: 'boat', parts: [l('ink', 'M50 14 L50 62', 4), p('yellow', 'M54 16 L54 58 L80 58 Z'), p('white', 'M46 24 L46 58 L26 58 Z'), p('blue', 'M12 62 L88 62 L76 84 L24 84 Z'), c('white', 38, 72, 3.5), c('white', 50, 72, 3.5), c('white', 62, 72, 3.5)] },
  { id: 'rocket', parts: [p('orange', 'M40 78 L60 78 L50 96 Z'), p('red', 'M34 56 L20 78 L36 74 Z'), p('red', 'M66 56 L80 78 L64 74 Z'), p('lightblue', 'M50 8 C70 24 68 60 64 78 L36 78 C32 60 30 24 50 8 Z'), p('red', 'M50 8 C58 14 62 20 64 26 L36 26 C38 20 42 14 50 8 Z'), c('ink', 50, 46, 9), c('blue', 50, 46, 6)] },
  { id: 'fish', parts: [p('orange', 'M70 50 L92 32 L90 68 Z'), e('orange', 44, 50, 32, 22), p('yellow', 'M36 30 L52 20 L56 32 Z'), c('white', 26, 44, 7), c('ink', 25, 45, 3.5), l('ink', 'M18 58 Q22 62 28 58', 3), l('yellow', 'M46 34 Q54 50 46 66', 4)] },
  { id: 'cat', parts: [p('orange', 'M18 50 L22 14 L42 30 Z'), p('orange', 'M82 50 L78 14 L58 30 Z'), c('orange', 50, 56, 32), p('pink', 'M26 36 L26 22 L36 31 Z'), p('pink', 'M74 36 L74 22 L64 31 Z'), ...eyes(50, 38, 62, 6), p('pink', 'M45 62 L55 62 L50 68 Z'), l('ink', 'M50 68 Q44 74 40 70 M50 68 Q56 74 60 70', 3)] },
  { id: 'dog', parts: [e('orange', 22, 46, 12, 24, 15), e('orange', 78, 46, 12, 24, -15), c('yellow', 50, 54, 30), c('orange', 62, 44, 9), ...eyes(46, 40, 60, 5.5), e('ink', 50, 62, 7, 5), p('red', 'M45 70 C45 82 55 82 55 70 Z')] },
  { id: 'bunny', parts: [e('pink', 36, 24, 9, 22, -8), e('pink', 64, 24, 9, 22, 8), e('white', 36, 26, 4, 14, -8), e('white', 64, 26, 4, 14, 8), c('pink', 50, 62, 28), ...eyes(56, 40, 60, 5.5), c('red', 50, 68, 4), r('white', 46, 72, 8, 8, 2)] },
  { id: 'frog', parts: [c('green', 32, 32, 14), c('green', 68, 32, 14), e('green', 50, 60, 38, 26), ...eyes(32, 32, 68, 8), l('ink', 'M30 64 Q50 78 70 64', 4), c('pink', 22, 66, 5), c('pink', 78, 66, 5)] },
  { id: 'ladybug', parts: [c('ink', 50, 22, 14), c('red', 50, 58, 34), l('ink', 'M50 26 L50 92', 4), c('ink', 34, 48, 6), c('ink', 66, 48, 6), c('ink', 36, 72, 6), c('ink', 64, 72, 6), c('white', 44, 18, 3), c('white', 56, 18, 3)] },
  { id: 'bee', parts: [e('lightblue', 40, 28, 14, 18, -20), e('lightblue', 62, 28, 14, 18, 20), e('yellow', 50, 60, 34, 24), r('ink', 42, 37, 8, 46, 2), r('ink', 60, 40, 8, 40, 2), c('ink', 20, 58, 12), c('white', 17, 54, 3.5), p('ink', 'M84 56 L96 60 L84 64 Z')] },
  { id: 'snail', parts: [e('green', 50, 78, 40, 10), c('green', 18, 66, 10), l('green', 'M14 58 L10 40 M22 58 L26 40', 4), c('ink', 10, 40, 3.5), c('ink', 26, 40, 3.5), c('orange', 58, 50, 28), c('yellow', 58, 50, 19), c('orange', 58, 50, 11), c('yellow', 60, 48, 4)] },
  { id: 'chick', parts: [c('yellow', 50, 64, 28), c('yellow', 50, 32, 20), e('orange', 30, 64, 8, 12, 20), e('orange', 70, 64, 8, 12, -20), p('orange', 'M44 36 L56 36 L50 46 Z'), c('ink', 42, 28, 3.5), c('ink', 58, 28, 3.5), p('yellow', 'M48 12 L52 4 L56 14 Z')] },
  { id: 'owl', parts: [p('purple', 'M18 20 L36 30 L22 40 Z'), p('purple', 'M82 20 L64 30 L78 40 Z'), e('purple', 50, 56, 34, 38), e('pink', 50, 70, 20, 20), c('white', 36, 42, 12), c('white', 64, 42, 12), c('ink', 37, 43, 6), c('ink', 63, 43, 6), p('orange', 'M45 52 L55 52 L50 62 Z')] },
  { id: 'turtle', parts: [c('yellow', 50, 16, 11), c('yellow', 20, 34, 9), c('yellow', 80, 34, 9), c('yellow', 22, 76, 9), c('yellow', 78, 76, 9), c('green', 50, 54, 32), c('yellow', 50, 54, 10), c('yellow', 34, 42, 6), c('yellow', 66, 42, 6), c('yellow', 34, 68, 6), c('yellow', 66, 68, 6), c('ink', 46, 13, 2.5), c('ink', 54, 13, 2.5)] },
  { id: 'house', parts: [r('yellow', 20, 44, 60, 44, 4), p('red', 'M10 48 L50 12 L90 48 Z'), r('blue', 42, 60, 16, 28, 3), r('lightblue', 26, 54, 12, 12, 2), r('lightblue', 64, 54, 12, 12, 2), r('red', 66, 18, 8, 16)] },
  { id: 'tree', parts: [r('orange', 42, 60, 16, 32, 3), c('green', 50, 36, 26), c('green', 30, 52, 16), c('green', 70, 52, 16), c('red', 40, 32, 4), c('red', 62, 44, 4), c('red', 48, 52, 4)] },
  { id: 'icecream', parts: [p('orange', 'M30 52 L70 52 L50 94 Z'), l('yellow', 'M38 60 L56 82 M62 60 L44 82', 3), c('pink', 50, 42, 22), c('lightblue', 50, 20, 14), c('red', 54, 8, 5)] },
  { id: 'cupcake', parts: [p('blue', 'M20 54 L80 54 L72 90 L28 90 Z'), l('lightblue', 'M38 56 L40 88 M50 56 L50 88 M62 56 L60 88', 4), e('pink', 50, 50, 34, 14), c('pink', 50, 34, 18), c('red', 50, 14, 8)] },
  { id: 'crown', parts: [p('yellow', 'M12 30 L30 52 L50 20 L70 52 L88 30 L82 82 L18 82 Z'), r('orange', 18, 70, 64, 12, 3), c('red', 50, 60, 6), c('blue', 32, 64, 4), c('blue', 68, 64, 4), c('red', 12, 30, 5), c('red', 50, 20, 5), c('red', 88, 30, 5)] },
  { id: 'diamond', parts: [p('lightblue', 'M26 18 L74 18 L92 40 L50 92 L8 40 Z'), p('blue', 'M8 40 L92 40 L50 92 Z'), p('white', 'M36 22 L46 22 L38 36 L28 36 Z')] },
  { id: 'lollipop', parts: [r('white', 46, 56, 8, 38, 3), c('pink', 50, 38, 30), c('purple', 50, 38, 22), c('pink', 50, 38, 14), c('purple', 50, 38, 6)] },
];

/** Цветовых вариантов у каждого дизайна. */
export const VARIANTS = 4;

/** Игровые цвета по кругу оттенков: вариант сдвигает цвет на 2 шага (чёрный — без изменений). */
const HUE_ORDER: readonly GameColorId[] = ['red', 'orange', 'yellow', 'green', 'lightblue', 'blue', 'purple', 'pink'];

export function recolor(color: StickerColor, variant: number): StickerColor {
  const index = HUE_ORDER.indexOf(color as GameColorId);
  if (index === -1 || variant === 0) {
    return color;
  }
  return HUE_ORDER[(index + variant * 2) % HUE_ORDER.length]!;
}

export interface StickerSpec {
  readonly design: StickerDesign;
  readonly variant: number;
}

/** Наклейка по номеру (с 0). */
export function stickerAt(n: number): StickerSpec {
  const index = Math.max(0, Math.floor(n));
  const count = STICKER_DESIGNS.length;
  return { design: STICKER_DESIGNS[index % count]!, variant: Math.floor(index / count) % VARIANTS };
}

/** Сколько разных наклеек, прежде чем пойдёт повтор. */
export const DISTINCT_STICKERS = STICKER_DESIGNS.length * VARIANTS;

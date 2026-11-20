import { type AntsState, type Block, SLOT_COUNT, type Slot } from '../../src/games/ants/logic';
import { parsePicture } from '../../src/games/ants/pictures';

/** Цвета по буквам, как в pictures.ts. */
export const R = 0;
export const B = 5;

/** Состояние из строк картинки, колонок и (необязательно) слотов. */
export function makeState(rows: string[], columns: Block[][], slots: (Slot | null)[] = []): AntsState {
  const picture = parsePicture({ id: 'test', rows });
  return {
    width: picture.width,
    height: picture.height,
    pixels: picture.pixels,
    columns,
    slots: Array.from({ length: SLOT_COUNT }, (_, index) => slots[index] ?? null),
  };
}

export const block = (color: number, ants: number): Block => ({ color, ants });

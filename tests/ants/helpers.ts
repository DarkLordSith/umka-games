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

/**
 * Бюджет генерации уровня: 200 мс на Mac — цель «без заметной паузы на iPhone».
 * Раннер GitHub Actions примерно вдвое медленнее, поэтому в CI бюджет ×2.
 */
export const LEVEL_BUDGET_MS = 200 * (process.env.CI ? 2 : 1);

/**
 * Время работы fn в мс, устойчивое к случайным паузам (GC, прогрев JIT): если первый
 * замер вышел за бюджет, меряем ещё дважды и берём медиану. fn должна быть детерминированной.
 */
export function stableMs(fn: () => unknown, budget = LEVEL_BUDGET_MS): number {
  const once = () => {
    const started = performance.now();
    fn();
    return performance.now() - started;
  };
  const first = once();
  if (first <= budget) {
    return first;
  }
  const runs = [first, once(), once()].sort((a, b) => a - b);
  return runs[1]!;
}

// Сидируемый генератор случайных чисел. Тот же seed → та же последовательность:
// на этом держится детерминизм уровней (makeLevel(level, seed)).

/** Функция-генератор: каждый вызов — число в [0, 1). */
export type Rng = () => number;

/** mulberry32 — маленький быстрый 32-битный генератор, для игр хватает с запасом. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Целое в [min, max] включительно. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Случайный элемент непустого массива. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: пустой массив');
  }
  return items[Math.floor(rng() * items.length)]!;
}

/** Перемешанная копия (Фишер — Йетс); исходный массив не меняется. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

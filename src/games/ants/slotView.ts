// Что показывает слот на экране. Логика освобождает слот сразу, как только раздала
// события поедания, а муравьи ещё бегут. На экране иначе:
// - число уменьшается, когда муравей ВЫБЕГАЕТ из слота;
// - блок исчезает, когда ПОСЛЕДНИЙ его муравей добежал до дырки.
// Каждый блок в слоте помечен tag: хвост муравьёв старого блока не трогает новый,
// если логика уже положила его в тот же слот (быстрые тапы).
import type { Slot } from './logic';

export interface SlotView {
  /** Метка блока (номер установки). */
  readonly tag: number;
  readonly color: number;
  /** Муравьёв ещё в слоте — это число и видно. */
  readonly left: number;
  /** Муравьёв в пути: выбежали, но ещё не в дырке. */
  readonly out: number;
}

export type SlotsView = readonly (SlotView | null)[];

/** Вид по логическим слотам (старт, Undo, «заново»): без муравьёв в пути. */
export function viewFromSlots(slots: readonly (Slot | null)[], tags: readonly number[]): SlotsView {
  return slots.map((slot, index) => (slot ? { tag: tags[index] ?? 0, color: slot.color, left: slot.left, out: 0 } : null));
}

/** В слот встал новый блок — показываем сразу, даже если хвост старого ещё бежит. */
export function placeBlock(view: SlotsView, slot: number, tag: number, color: number, ants: number): SlotsView {
  return view.map((entry, index) => (index === slot ? { tag, color, left: ants, out: 0 } : entry));
}

/** Муравей блока tag выбежал из слота. */
export function antLeft(view: SlotsView, slot: number, tag: number): SlotsView {
  const entry = view[slot];
  if (!entry || entry.tag !== tag || entry.left === 0) {
    return view;
  }
  return view.map((item, index) => (index === slot ? { ...entry, left: entry.left - 1, out: entry.out + 1 } : item));
}

/** Муравей блока tag добежал до дырки; последний — слот пустеет. */
export function antHome(view: SlotsView, slot: number, tag: number): SlotsView {
  const entry = view[slot];
  if (!entry || entry.tag !== tag) {
    return view;
  }
  const out = Math.max(0, entry.out - 1);
  const next = entry.left === 0 && out === 0 ? null : { ...entry, out };
  return view.map((item, index) => (index === slot ? next : item));
}

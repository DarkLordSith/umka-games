// Муравьи: правила. Чистые функции над неизменяемыми снимками, без React и DOM.
// Правила механики — docs/BACKLOG.md → «Правила механик» → «Муравьи».

/** Мест в муравейнике (пул слотов). */
export const SLOT_COUNT = 5;
/** Пустая клетка картинки. */
export const EMPTY = -1;

/** Блок в колонке: цвет (индекс в GAME_COLORS) и сколько в нём муравьёв. */
export interface Block {
  readonly color: number;
  readonly ants: number;
}

/** Блок в слоте: цвет и сколько муравьёв ещё не съели свой пиксель. */
export interface Slot {
  readonly color: number;
  readonly left: number;
}

export interface AntsState {
  readonly width: number;
  readonly height: number;
  /** Клетки картинки построчно: индекс цвета или EMPTY. Длина width × height. */
  readonly pixels: readonly number[];
  /** Колонки блоков; в каждой верхний блок — первый. */
  readonly columns: readonly (readonly Block[])[];
  /** Ровно SLOT_COUNT мест; null — свободно. */
  readonly slots: readonly (Slot | null)[];
}

/** Ход — индекс колонки, по верхнему блоку которой тапнули. */
export type AntsMove = number;

/** Муравей из слота `slot` съел пиксель (x, y). По этим событиям экран анимирует муравьёв. */
export interface EatEvent {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
}

export interface TapResult {
  readonly state: AntsState;
  /** В какой слот встал блок. */
  readonly slot: number;
  /** Съеденные пиксели по порядку. */
  readonly events: readonly EatEvent[];
}

/** Пиксель доступен: непустой и хотя бы один сосед по 4 направлениям пуст или за краем. */
function accessibleAt(width: number, height: number, pixels: readonly number[], index: number): boolean {
  if (pixels[index] === EMPTY) {
    return false;
  }
  const x = index % width;
  const y = (index - x) / width;
  return (
    x === 0 ||
    y === 0 ||
    x === width - 1 ||
    y === height - 1 ||
    pixels[index - 1] === EMPTY ||
    pixels[index + 1] === EMPTY ||
    pixels[index - width] === EMPTY ||
    pixels[index + width] === EMPTY
  );
}

export function isAccessible(state: AntsState, x: number, y: number): boolean {
  return accessibleAt(state.width, state.height, state.pixels, y * state.width + x);
}

/**
 * Квадрат расстояния от клетки до муравейника. Муравейник — под картинкой
 * по центру, в точке ((width − 1) / 2, height). Считаем в удвоенных
 * координатах, чтобы остаться в целых числах.
 */
function anthillDistance(width: number, height: number, index: number): number {
  const x = index % width;
  const y = (index - x) / width;
  const dx = 2 * x - (width - 1);
  const dy = 2 * (height - y);
  return dx * dx + dy * dy;
}

/** Индексы клеток по близости к муравейнику; кэш по размеру картинки. */
const anthillOrders = new Map<string, readonly number[]>();

/**
 * Порядок обхода клеток: ближе к муравейнику — раньше; при равенстве — меньший
 * номер строки, потом столбца (то есть меньший индекс).
 */
function anthillOrder(width: number, height: number): readonly number[] {
  const key = `${width}x${height}`;
  let order = anthillOrders.get(key);
  if (!order) {
    order = Array.from({ length: width * height }, (_, index) => index).sort(
      (a, b) => anthillDistance(width, height, a) - anthillDistance(width, height, b) || a - b,
    );
    anthillOrders.set(key, order);
  }
  return order;
}

/**
 * Какой пиксель цвета `color` съест следующий муравей: первый доступный
 * в порядке anthillOrder. −1 — есть нечего.
 */
function nextPixel(width: number, height: number, pixels: readonly number[], color: number): number {
  for (const index of anthillOrder(width, height)) {
    if (pixels[index] === color && accessibleAt(width, height, pixels, index)) {
      return index;
    }
  }
  return -1;
}

/** Есть ли у цвета хотя бы один доступный пиксель. */
export function canEat(state: AntsState, color: number): boolean {
  return nextPixel(state.width, state.height, state.pixels, color) !== -1;
}

/** Все доступные пиксели (для экрана и тестов). */
export function accessiblePixels(state: AntsState): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (let index = 0; index < state.pixels.length; index++) {
    if (accessibleAt(state.width, state.height, state.pixels, index)) {
      result.push({ x: index % state.width, y: Math.floor(index / state.width) });
    }
  }
  return result;
}

/** Первый свободный слот или −1. */
export function freeSlot(state: AntsState): number {
  return state.slots.indexOf(null);
}

/**
 * Разрешение после хода: по кругу (слоты 0…4) каждый занятый слот съедает
 * 1 доступный пиксель своего цвета; блок с left = 0 уходит из слота.
 * Повторяем, пока хоть кто-то может есть. Мутирует переданные копии.
 */
function resolve(width: number, height: number, pixels: number[], slots: (Slot | null)[]): EatEvent[] {
  const events: EatEvent[] = [];
  let ate = true;
  while (ate) {
    ate = false;
    for (let slot = 0; slot < slots.length; slot++) {
      const occupant = slots[slot];
      if (!occupant) {
        continue;
      }
      const index = nextPixel(width, height, pixels, occupant.color);
      if (index === -1) {
        continue;
      }
      pixels[index] = EMPTY;
      events.push({ slot, x: index % width, y: Math.floor(index / width) });
      slots[slot] = occupant.left > 1 ? { color: occupant.color, left: occupant.left - 1 } : null;
      ate = true;
    }
  }
  return events;
}

/**
 * Тап по колонке: верхний блок уходит в первый свободный слот, затем муравьи едят.
 * null — ход невозможен (колонка пуста или свободных слотов нет). state не мутирует.
 */
export function tap(state: AntsState, column: AntsMove): TapResult | null {
  const blocks = state.columns[column];
  const slot = freeSlot(state);
  if (!blocks || blocks.length === 0 || slot === -1) {
    return null;
  }
  const block = blocks[0]!;
  const pixels = [...state.pixels];
  const slots = [...state.slots];
  slots[slot] = { color: block.color, left: block.ants };
  const events = resolve(state.width, state.height, pixels, slots);
  const columns = state.columns.map((items, index) => (index === column ? items.slice(1) : items));
  return { state: { ...state, pixels, columns, slots }, slot, events };
}

/** Ход по контракту игры: новое состояние или null. */
export function applyMove(state: AntsState, column: AntsMove): AntsState | null {
  return tap(state, column)?.state ?? null;
}

/** Колонки, по которым сейчас можно тапнуть. */
export function legalMoves(state: AntsState): AntsMove[] {
  if (freeSlot(state) === -1) {
    return [];
  }
  return state.columns.flatMap((blocks, index) => (blocks.length > 0 ? [index] : []));
}

export function isWon(state: AntsState): boolean {
  return state.pixels.every(cell => cell === EMPTY);
}

/** Тупик: свободных слотов нет и никто не может есть. Лечится Undo. */
export function isStuck(state: AntsState): boolean {
  return freeSlot(state) === -1 && state.slots.every(slot => slot !== null && !canEat(state, slot.color));
}

/** Пикселей каждого цвета на картинке. */
export function pixelsByColor(state: AntsState): Map<number, number> {
  const counts = new Map<number, number>();
  for (const cell of state.pixels) {
    if (cell !== EMPTY) {
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  }
  return counts;
}

/** Муравьёв каждого цвета: в колонках и в слотах. Инвариант: равно pixelsByColor. */
export function antsByColor(state: AntsState): Map<number, number> {
  const counts = new Map<number, number>();
  const add = (color: number, ants: number) => counts.set(color, (counts.get(color) ?? 0) + ants);
  for (const blocks of state.columns) {
    for (const block of blocks) {
      add(block.color, block.ants);
    }
  }
  for (const slot of state.slots) {
    if (slot) {
      add(slot.color, slot.left);
    }
  }
  return counts;
}

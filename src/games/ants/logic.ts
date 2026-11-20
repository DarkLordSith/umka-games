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

/**
 * «Снаружи»: пустые клетки, связанные с внешним краем картинки (заливка от края по пустым).
 * Замкнутая дырка внутри картинки (бублик, руль) — не снаружи: муравьи сквозь стену не ходят.
 * 1 — снаружи, 0 — нет (непустая клетка или замкнутая дырка).
 */
export function outsideMask(width: number, height: number, pixels: readonly number[]): Uint8Array {
  const outside = new Uint8Array(pixels.length);
  const queue: number[] = [];
  const seed = (index: number) => {
    if (pixels[index] === EMPTY && outside[index] === 0) {
      outside[index] = 1;
      queue.push(index);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  flood(width, pixels, outside, queue);
  return outside;
}

/** Заливка «снаружи» от клеток очереди по пустым соседям. Мутирует outside. */
function flood(width: number, pixels: readonly number[], outside: Uint8Array, queue: number[]): void {
  while (queue.length > 0) {
    const index = queue.pop()!;
    const x = index % width;
    const visit = (next: number) => {
      if (pixels[next] === EMPTY && outside[next] === 0) {
        outside[next] = 1;
        queue.push(next);
      }
    };
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index + width < pixels.length) visit(index + width);
  }
}

/** Клетку съели: она теперь снаружи, и через неё наружу открываются замкнутые дырки рядом. */
function openCell(width: number, pixels: readonly number[], outside: Uint8Array, index: number): void {
  outside[index] = 1;
  flood(width, pixels, outside, [index]);
}

/**
 * Пиксель доступен: непустой и граничит с краем картинки или с пустой клеткой,
 * связанной с внешним краем (outsideMask).
 */
function accessibleAt(width: number, height: number, pixels: readonly number[], outside: Uint8Array, index: number): boolean {
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
    outside[index - 1] === 1 ||
    outside[index + 1] === 1 ||
    outside[index - width] === 1 ||
    outside[index + width] === 1
  );
}

/** Индексы доступных пикселей картинки (генератор снимает по ним «луковицу»). */
export function accessibleIndices(width: number, height: number, pixels: readonly number[]): number[] {
  const outside = outsideMask(width, height, pixels);
  const result: number[] = [];
  for (let index = 0; index < pixels.length; index++) {
    if (accessibleAt(width, height, pixels, outside, index)) {
      result.push(index);
    }
  }
  return result;
}

export function isAccessible(state: AntsState, x: number, y: number): boolean {
  const outside = outsideMask(state.width, state.height, state.pixels);
  return accessibleAt(state.width, state.height, state.pixels, outside, y * state.width + x);
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
function nextPixel(width: number, height: number, pixels: readonly number[], outside: Uint8Array, color: number): number {
  for (const index of anthillOrder(width, height)) {
    if (pixels[index] === color && accessibleAt(width, height, pixels, outside, index)) {
      return index;
    }
  }
  return -1;
}

/** Есть ли у цвета хотя бы один доступный пиксель. */
export function canEat(state: AntsState, color: number): boolean {
  return canEatWith(state, outsideMask(state.width, state.height, state.pixels), color);
}

function canEatWith(state: AntsState, outside: Uint8Array, color: number): boolean {
  return nextPixel(state.width, state.height, state.pixels, outside, color) !== -1;
}

/** Все доступные пиксели (для экрана и тестов). */
export function accessiblePixels(state: AntsState): { x: number; y: number }[] {
  return accessibleIndices(state.width, state.height, state.pixels).map(index => ({
    x: index % state.width,
    y: Math.floor(index / state.width),
  }));
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
  const outside = outsideMask(width, height, pixels);
  let ate = true;
  while (ate) {
    ate = false;
    for (let slot = 0; slot < slots.length; slot++) {
      const occupant = slots[slot];
      if (!occupant) {
        continue;
      }
      const index = nextPixel(width, height, pixels, outside, occupant.color);
      if (index === -1) {
        continue;
      }
      pixels[index] = EMPTY;
      openCell(width, pixels, outside, index);
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
  if (freeSlot(state) !== -1) {
    return false;
  }
  const outside = outsideMask(state.width, state.height, state.pixels);
  return state.slots.every(slot => slot !== null && !canEatWith(state, outside, slot.color));
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

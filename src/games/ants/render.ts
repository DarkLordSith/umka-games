// Canvas-слой муравьёв: картинка из пикселей, дырка-муравейник и бегущие муравьи.
// Почему canvas: 256 пикселей + десятки муравьёв в движении каждый кадр — это
// один проход отрисовки без сотен DOM-узлов и пересчёта стилей; 60 fps на iPhone.
// Колонки, слоты и кнопки — DOM (их нужно нажимать и анимировать CSS).
//
// Логика уже посчитана (logic.ts), рендер только «догоняет»: пиксель из события
// хода остаётся видимым, пока до него не добежит муравей.
//
// Путь муравья — только по горизонтали и вертикали (paths.ts): из слота вверх
// к муравейнику, к краю картинки, дальше по пустым клеткам и полю вокруг
// картинки, не сквозь несъеденные пиксели. Путь считается в момент выхода
// муравья (к пикселю) и в момент, когда он его взял (обратно).
import { GAME_COLORS, SHADOW, UI_COLORS } from '../../ui/palette';
import { type AntsState, EMPTY, type EatEvent } from './logic';
import { type Cell, corners, gridPath } from './paths';

// ---- скорость: подкручивать здесь ----
/** Скорость муравья, CSS px в мс (было 0.75 — вдвое быстрее). */
export const ANT_SPEED = 0.36;
/** Интервал между выходами муравьёв одного хода, мс. */
export const ANT_STAGGER = 150;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Где что лежит на экране — в CSS-пикселях относительно canvas. */
export interface Layout {
  readonly picture: Rect;
  readonly hole: Point;
  readonly slots: readonly Point[];
}

/** Событие хода с меткой блока в слоте (см. slotView.ts). */
export interface TaggedEvent extends EatEvent {
  readonly tag: number;
}

export interface RendererCallbacks {
  /** Муравей выбежал из слота. */
  readonly onLeave?: (slot: number, tag: number) => void;
  /** Муравей добежал до дырки. */
  readonly onHome?: (slot: number, tag: number) => void;
}

type Phase = 'wait' | 'out' | 'back';

interface Ant {
  readonly slot: number;
  readonly tag: number;
  /** Пиксель, который муравей съест. */
  readonly pixel: number;
  /** Цвет пикселя = цвет блока (муравей ест только свой цвет). */
  readonly color: number;
  readonly launch: number;
  phase: Phase;
  /** Ломаная текущей фазы и когда фаза началась. */
  path: Point[];
  length: number;
  start: number;
}

// Пиксельный муравей 8×5, голова справа: x — тело цвета блока, a — тёмные усики, глаз и ножки.
// Две раскладки ног чередуются — «шаг». (Мультяшный муравей — задача 3б.)
const ANT_BODY = ['......a.', '.xx...xa', 'xxxxxxxx', '.xx.x.xx'];
const ANT_LEGS = ['a.a.a.a.', '.a.a.a.a'];

const color = (index: number): string => GAME_COLORS[index]?.hex ?? UI_COLORS.ink;

function pathLength(path: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.abs(path[i]!.x - path[i - 1]!.x) + Math.abs(path[i]!.y - path[i - 1]!.y);
  }
  return total;
}

/** Точка на ломаной на расстоянии distance от начала и направление участка. */
function pointAt(path: readonly Point[], distance: number): { point: Point; dx: number; dy: number } {
  let left = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segment = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (left <= segment || i === path.length - 1) {
      const t = segment === 0 ? 1 : Math.min(1, left / segment);
      return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, dx: b.x - a.x, dy: b.y - a.y };
    }
    left -= segment;
  }
  return { point: path[path.length - 1] ?? { x: 0, y: 0 }, dx: 1, dy: 0 };
}

export class AntsRenderer {
  private readonly context: CanvasRenderingContext2D;
  private layout: Layout | null = null;
  private state: AntsState;
  /** Пиксели, которые съедены по логике, но муравей ещё не добежал: индекс → цвет. */
  private readonly pending = new Map<number, number>();
  private ants: Ant[] = [];
  /** Победа: показываем исходную картинку и подпрыгиваем. */
  private win: { readonly pixels: readonly number[]; readonly start: number } | null = null;
  private idle: (() => void) | null = null;
  private frame = 0;
  private width = 0;
  private height = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    state: AntsState,
    private readonly callbacks: RendererCallbacks = {},
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('canvas 2d недоступен');
    }
    this.context = context;
    this.state = state;
  }

  /** Размер canvas и раскладка в CSS px. Вызывать при каждом изменении размеров. */
  resize(width: number, height: number, layout: Layout): void {
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.layout = layout;
    this.request();
  }

  /** Мгновенно показать состояние (Undo, «заново», новый уровень): муравьи исчезают. */
  reset(state: AntsState): void {
    this.state = state;
    this.ants = [];
    this.pending.clear();
    this.win = null;
    this.idle = null;
    this.request();
  }

  /**
   * Новый ход: state — уже после хода, events — что съедено (с меткой блока).
   * Муравьи выходят через delay мс (пока блок летит в слот) с интервалом ANT_STAGGER.
   * Муравьи прошлых ходов продолжают бежать параллельно — как отряды из разных слотов.
   */
  play(state: AntsState, events: readonly TaggedEvent[], delay: number): void {
    const previous = this.state;
    this.state = state;
    let launch = performance.now() + delay;
    for (const event of events) {
      const pixel = event.y * state.width + event.x;
      const pixelColor = this.pending.get(pixel) ?? previous.pixels[pixel] ?? EMPTY;
      this.pending.set(pixel, pixelColor);
      this.ants.push({
        slot: event.slot,
        tag: event.tag,
        pixel,
        color: pixelColor,
        launch,
        phase: 'wait',
        path: [],
        length: 0,
        start: launch,
      });
      launch += ANT_STAGGER;
    }
    this.request();
  }

  /** Вызвать callback, когда все муравьи добегут (сразу в следующем кадре, если их нет). */
  whenIdle(callback: () => void): void {
    this.idle = callback;
    this.request();
  }

  /** Победа: исходная картинка возвращается и подпрыгивает. */
  showWin(pixels: readonly number[]): void {
    this.win = { pixels, start: performance.now() };
    this.request();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private request(): void {
    if (this.frame === 0) {
      this.frame = requestAnimationFrame(time => {
        this.frame = 0;
        this.draw(time);
      });
    }
  }

  private cell(): number {
    return (this.layout?.picture.w ?? 0) / this.state.width;
  }

  /** Центр клетки сетки (с полем: x от −1 до width). */
  private cellCenter(cell: Cell): Point {
    const picture = this.layout!.picture;
    const size = this.cell();
    return { x: picture.x + (cell.x + 0.5) * size, y: picture.y + (cell.y + 0.5) * size };
  }

  /** Клетка поля под картинкой, через которую муравьи входят и выходят: ближе к цели. */
  private gate(target: number): Cell {
    const { width, height } = this.state;
    const x = target % width < width / 2 ? Math.floor((width - 1) / 2) : Math.ceil((width - 1) / 2);
    return { x, y: height };
  }

  /** Клетки от ворот до пикселя: сначала в обход видимых пикселей, не вышло — по логике. */
  private cellsTo(target: number, reverse: boolean): Cell[] {
    const { width, height, pixels } = this.state;
    const goal = { x: target % width, y: Math.floor(target / width) };
    const gate = this.gate(target);
    const shown = (index: number) => pixels[index] !== EMPTY || (index !== target && this.pending.has(index));
    const eaten = (index: number) => pixels[index] !== EMPTY;
    const path = gridPath(width, height, shown, gate, goal) ?? gridPath(width, height, eaten, gate, goal) ?? [gate, goal];
    return reverse ? path.reverse() : path;
  }

  /** Путь к пикселю: слот → вверх до муравейника → к нему → вверх к воротам → по сетке. */
  private outboundPath(ant: Ant): Point[] {
    const layout = this.layout!;
    const slot = layout.slots[ant.slot] ?? layout.hole;
    const cells = this.cellsTo(ant.pixel, false).map(cell => this.cellCenter(cell));
    const gate = cells[0]!;
    return corners([
      slot,
      { x: slot.x, y: layout.hole.y },
      layout.hole,
      { x: layout.hole.x, y: gate.y },
      ...cells,
    ]);
  }

  /** Путь обратно: от пикселя по сетке к воротам → вниз в муравейник. */
  private homePath(ant: Ant): Point[] {
    const layout = this.layout!;
    const cells = this.cellsTo(ant.pixel, true).map(cell => this.cellCenter(cell));
    const gate = cells[cells.length - 1]!;
    return corners([...cells, { x: layout.hole.x, y: gate.y }, layout.hole]);
  }

  /** Переходы фаз: выход из слота, взял пиксель, вернулся в дырку. */
  private advance(time: number): void {
    const finished: Ant[] = [];
    for (const ant of this.ants) {
      for (;;) {
        if (ant.phase === 'wait' && time >= ant.launch) {
          ant.phase = 'out';
          ant.path = this.outboundPath(ant);
          ant.length = pathLength(ant.path);
          ant.start = ant.launch;
          this.callbacks.onLeave?.(ant.slot, ant.tag);
        } else if (ant.phase === 'out' && time >= ant.start + ant.length / ANT_SPEED) {
          this.pending.delete(ant.pixel);
          ant.start += ant.length / ANT_SPEED;
          ant.phase = 'back';
          ant.path = this.homePath(ant);
          ant.length = pathLength(ant.path);
        } else if (ant.phase === 'back' && time >= ant.start + ant.length / ANT_SPEED) {
          finished.push(ant);
          break;
        } else {
          break;
        }
      }
    }
    if (finished.length > 0) {
      this.ants = this.ants.filter(ant => !finished.includes(ant));
      for (const ant of finished) {
        this.callbacks.onHome?.(ant.slot, ant.tag);
      }
    }
  }

  private draw(time: number): void {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    if (!this.layout) {
      return;
    }
    this.advance(time);
    this.drawBoard();
    if (this.win) {
      this.drawWin(time - this.win.start, this.win.pixels);
    } else {
      this.drawPixels();
    }
    this.drawHole();
    for (const ant of this.ants) {
      this.drawAnt(ant, time);
    }
    if (this.ants.length === 0 && this.idle) {
      const idle = this.idle;
      this.idle = null;
      idle();
    }
    if (this.ants.length > 0 || this.win) {
      this.request();
    }
  }

  private drawBoard(): void {
    const { picture } = this.layout!;
    const context = this.context;
    const pad = this.cell() * 0.4;
    context.fillStyle = UI_COLORS.panel;
    context.beginPath();
    context.roundRect(picture.x - pad, picture.y - pad, picture.w + pad * 2, picture.h + pad * 2, pad * 2);
    context.fill();
  }

  private drawPixels(): void {
    const { pixels, width } = this.state;
    for (let index = 0; index < pixels.length; index++) {
      const cell = pixels[index] !== EMPTY ? pixels[index]! : (this.pending.get(index) ?? EMPTY);
      if (cell !== EMPTY) {
        this.drawPixel(index % width, Math.floor(index / width), cell, 1);
      }
    }
  }

  /** Пиксель-«конфета»: скруглённый квадрат с бликом сверху. */
  private drawPixel(x: number, y: number, cell: number, scale: number, origin?: Point): void {
    const { picture } = this.layout!;
    const size = this.cell() * scale;
    const left = origin ? origin.x + (x - this.state.width / 2) * size : picture.x + x * size;
    const top = origin ? origin.y + (y - this.state.height / 2) * size : picture.y + y * size;
    const gap = Math.max(1, size * 0.06);
    const context = this.context;
    context.fillStyle = color(cell);
    context.beginPath();
    context.roundRect(left + gap / 2, top + gap / 2, size - gap, size - gap, size * 0.22);
    context.fill();
    context.globalAlpha = 0.28;
    context.fillStyle = UI_COLORS.white;
    context.fillRect(left + size * 0.2, top + size * 0.16, size * 0.36, size * 0.14);
    context.globalAlpha = 1;
  }

  private drawWin(elapsed: number, pixels: readonly number[]): void {
    const { picture } = this.layout!;
    // появляется за 300 мс, потом подпрыгивает
    const appear = Math.min(1, elapsed / 300);
    const bounce = elapsed > 300 ? Math.abs(Math.sin(((elapsed - 300) / 700) * Math.PI)) * 0.06 : 0;
    const scale = (0.6 + 0.4 * appear) * (1 + bounce);
    const origin = { x: picture.x + picture.w / 2, y: picture.y + picture.h / 2 - bounce * picture.h * 0.6 };
    this.context.globalAlpha = appear;
    pixels.forEach((cell, index) => {
      if (cell !== EMPTY) {
        this.context.globalAlpha = appear;
        this.drawPixel(index % this.state.width, Math.floor(index / this.state.width), cell, scale, origin);
      }
    });
    this.context.globalAlpha = 1;
  }

  private drawHole(): void {
    const { hole } = this.layout!;
    const size = Math.max(10, this.cell() * 1.6);
    const context = this.context;
    context.fillStyle = SHADOW;
    context.beginPath();
    context.ellipse(hole.x, hole.y + size * 0.12, size * 1.25, size * 0.62, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = UI_COLORS.ink;
    context.beginPath();
    context.ellipse(hole.x, hole.y, size * 0.95, size * 0.45, 0, 0, Math.PI * 2);
    context.fill();
  }

  private drawAnt(ant: Ant, time: number): void {
    if (ant.phase === 'wait') {
      return;
    }
    const { point, dx, dy } = pointAt(ant.path, (time - ant.start) * ANT_SPEED);
    // спрайт смотрит вправо; поворачиваем по направлению участка
    const angle = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? Math.PI : 0) : dy < 0 ? -Math.PI / 2 : Math.PI / 2;
    const unit = Math.max(1.5, this.cell() * 0.13);
    const step = Math.floor(time / 110) % 2;
    const context = this.context;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    // влево — зеркалим, а не переворачиваем вверх ногами
    if (angle === Math.PI) {
      context.scale(1, -1);
    }
    const plot = (row: string, y: number) => {
      for (let x = 0; x < row.length; x++) {
        const mark = row[x];
        if (mark === 'x' || mark === 'a') {
          context.fillStyle = mark === 'x' ? color(ant.color) : UI_COLORS.ink;
          context.fillRect((x - 4) * unit, (y - 2.5) * unit, unit, unit);
        }
      }
    };
    ANT_BODY.forEach((row, y) => plot(row, y));
    plot(ANT_LEGS[step]!, ANT_BODY.length);
    context.restore();
    // обратный путь — несёт пиксель над собой
    if (ant.phase === 'back') {
      const piece = this.cell() * 0.5;
      context.fillStyle = color(ant.color);
      context.beginPath();
      context.roundRect(point.x - piece / 2, point.y - 2.5 * unit - piece * 0.9, piece, piece, piece * 0.25);
      context.fill();
    }
  }
}

// Canvas-слой муравьёв: картинка из пикселей, дырка-муравейник и бегущие муравьи.
// Почему canvas: 256 пикселей + десятки муравьёв в движении каждый кадр — это
// один проход отрисовки без сотен DOM-узлов и пересчёта стилей; 60 fps на iPhone.
// Колонки, слоты и кнопки — DOM (их нужно нажимать и анимировать CSS).
//
// Логика уже посчитана (logic.ts), рендер только «догоняет»: пиксель из события
// хода остаётся видимым, пока до него не добежит муравей.
import { GAME_COLORS, SHADOW, UI_COLORS } from '../../ui/palette';
import { type AntsState, EMPTY, type EatEvent } from './logic';

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

interface Ant {
  /** Пиксель, который муравей съест. */
  readonly pixel: number;
  /** Цвет пикселя = цвет блока (муравей ест только свой цвет). */
  readonly pixelColor: number;
  readonly from: Point;
  readonly launch: number;
  readonly arrive: number;
  readonly done: number;
}

/** Скорость муравья, CSS px в мс. */
const ANT_SPEED = 0.75;
/** Интервал между муравьями одного хода: не больше 70 мс и весь «хвост» не дольше ~600 мс. */
const MAX_STAGGER = 70;
const STAGGER_BUDGET = 600;

// Пиксельный муравей 8×5, голова справа: x — тело цвета блока, a — тёмные усики, глаз и ножки.
// Две раскладки ног чередуются — «шаг».
const ANT_BODY = ['......a.', '.xx...xa', 'xxxxxxxx', '.xx.x.xx'];
const ANT_LEGS = ['a.a.a.a.', '.a.a.a.a'];

const color = (index: number): string => GAME_COLORS[index]?.hex ?? UI_COLORS.ink;

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
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
  private frame = 0;
  private width = 0;
  private height = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    state: AntsState,
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
    this.request();
  }

  /**
   * Новый ход: state — уже после хода, events — что съедено. Муравьи стартуют
   * через delay мс (пока блок летит в слот). Возвращает, через сколько мс
   * последний муравей вернётся в дырку.
   */
  play(state: AntsState, events: readonly EatEvent[], delay: number): number {
    const previous = this.state;
    this.state = state;
    const layout = this.layout;
    if (!layout || events.length === 0) {
      this.request();
      return delay;
    }
    const now = performance.now();
    const stagger = Math.min(MAX_STAGGER, STAGGER_BUDGET / events.length);
    let end = 0;
    events.forEach((event, order) => {
      const pixel = event.y * state.width + event.x;
      const pixelColor = this.pending.get(pixel) ?? previous.pixels[pixel] ?? EMPTY;
      const from = layout.slots[event.slot] ?? layout.hole;
      const target = this.pixelCenter(pixel);
      const launch = now + delay + order * stagger;
      const arrive = launch + distance(from, target) / ANT_SPEED;
      const done = arrive + distance(target, layout.hole) / ANT_SPEED;
      this.pending.set(pixel, pixelColor);
      this.ants.push({ pixel, pixelColor, from, launch, arrive, done });
      end = Math.max(end, done - now);
    });
    this.request();
    return end;
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

  private pixelCenter(index: number): Point {
    const picture = this.layout!.picture;
    const size = this.cell();
    const x = index % this.state.width;
    const y = Math.floor(index / this.state.width);
    return { x: picture.x + (x + 0.5) * size, y: picture.y + (y + 0.5) * size };
  }

  private draw(time: number): void {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    if (!this.layout) {
      return;
    }
    // муравьи, добежавшие до пикселя, его «забирают»; вернувшиеся — исчезают
    for (const ant of this.ants) {
      if (time >= ant.arrive) {
        this.pending.delete(ant.pixel);
      }
    }
    this.ants = this.ants.filter(ant => time < ant.done);

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
    const size = this.cell() * 1.6;
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
    if (time < ant.launch) {
      return;
    }
    const layout = this.layout!;
    const target = this.pixelCenter(ant.pixel);
    const outbound = time < ant.arrive;
    const position = outbound
      ? lerp(ant.from, target, (time - ant.launch) / (ant.arrive - ant.launch))
      : lerp(target, layout.hole, (time - ant.arrive) / (ant.done - ant.arrive));
    const heading = outbound ? target.x - ant.from.x : layout.hole.x - target.x;
    const unit = Math.max(1.5, this.cell() * 0.13);
    const step = Math.floor(time / 90) % 2;
    const context = this.context;
    const left = position.x - 4 * unit;
    const top = position.y - 2.5 * unit;
    const flip = heading < 0;
    const plot = (row: string, y: number) => {
      for (let x = 0; x < row.length; x++) {
        const mark = row[flip ? row.length - 1 - x : x];
        if (mark === 'x' || mark === 'a') {
          context.fillStyle = mark === 'x' ? color(ant.pixelColor) : UI_COLORS.ink;
          context.fillRect(left + x * unit, top + y * unit, unit, unit);
        }
      }
    };
    ANT_BODY.forEach((row, y) => plot(row, y));
    plot(ANT_LEGS[step]!, ANT_BODY.length);
    // обратный путь — несёт пиксель над собой
    if (!outbound) {
      const piece = this.cell() * 0.5;
      context.fillStyle = color(ant.pixelColor);
      context.beginPath();
      context.roundRect(position.x - piece / 2, top - piece * 0.9, piece, piece, piece * 0.25);
      context.fill();
    }
  }
}

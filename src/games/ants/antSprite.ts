// Мультяшный муравей и спрайт-атлас.
//
// Муравей нарисован кодом (свой, не из оригинальной игры), вид сверху:
// крупное брюшко, маленькая грудь, круглая голова с большими глазами,
// усики с шариками, 6 лапок. Тело цвета блока, тёмный контур, мягкий блик —
// тот же «конфетный» стиль, что у блоков.
//
// Атлас: при старте (и при смене размера клетки) каждый кадр рисуется ОДИН раз
// в offscreen canvas — 8 цветов × 4 направления × 3 кадра ходьбы. В кадре игры
// муравей — это один drawImage из атласа, без рисования лапок и поворотов.
// Вид сверху симметричен, поэтому направления — просто повёрнутые копии
// (влево — не «вверх ногами»).
import { GAME_COLORS, UI_COLORS } from '../../ui/palette';

/** Направления в порядке поворота на 90° по часовой: вправо, вниз, влево, вверх. */
export const DIRECTIONS = ['right', 'down', 'left', 'up'] as const;
export type Direction = (typeof DIRECTIONS)[number];
/** Кадров ходьбы: лапки вперёд — посередине — назад. */
export const FRAMES = 3;
/** Порядок кадров в цикле шага: 0 → 1 → 2 → 1 → 0 … */
export const WALK_CYCLE = [0, 1, 2, 1] as const;
/** Сторона клетки атласа в длинах муравья: с запасом под лапки и усики. */
const BOX = 1.5;

export function directionOf(dx: number, dy: number): Direction {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

/**
 * Муравей головой вправо, центр — в (0, 0), длина тела `length`.
 * frame — кадр ходьбы 0…2: две «треноги» лапок шагают навстречу друг другу.
 */
export function drawCartoonAnt(context: CanvasRenderingContext2D, body: string, length: number, frame: number): void {
  const L = length;
  const outline = Math.max(1, L * 0.035);
  // смещение «треноги» A (передняя левая, средняя правая, задняя левая); у B — обратное
  const swing = (frame - 1) * L * 0.045;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // лапки: от груди наружу, с коленом
  context.strokeStyle = UI_COLORS.ink;
  context.lineWidth = Math.max(1, L * 0.045);
  const legs = [
    { x: L * 0.06, side: -1, tripod: 1 },
    { x: L * 0.06, side: 1, tripod: -1 },
    { x: 0, side: -1, tripod: -1 },
    { x: 0, side: 1, tripod: 1 },
    { x: -L * 0.06, side: -1, tripod: 1 },
    { x: -L * 0.06, side: 1, tripod: -1 },
  ];
  legs.forEach((leg, index) => {
    const spread = index < 2 ? 0.12 : index < 4 ? 0 : -0.12; // передние — вперёд, задние — назад
    const dx = spread * L + leg.tripod * swing;
    context.beginPath();
    context.moveTo(leg.x, leg.side * L * 0.05);
    context.lineTo(leg.x + dx * 0.5, leg.side * L * 0.2);
    context.lineTo(leg.x + dx, leg.side * L * 0.3);
    context.stroke();
  });

  // усики с шариками
  context.lineWidth = Math.max(1, L * 0.035);
  for (const side of [-1, 1]) {
    const tipX = L * 0.5 + swing * 0.2;
    const tipY = side * L * 0.2;
    context.beginPath();
    context.moveTo(L * 0.3, side * L * 0.06);
    context.quadraticCurveTo(L * 0.42, side * L * 0.08, tipX, tipY);
    context.stroke();
    context.fillStyle = UI_COLORS.ink;
    context.beginPath();
    context.arc(tipX, tipY, L * 0.045, 0, Math.PI * 2);
    context.fill();
  }

  // тело: брюшко, грудь, голова — цвет блока с тёмным контуром
  const blob = (x: number, rx: number, ry: number) => {
    context.beginPath();
    context.ellipse(x, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fillStyle = body;
    context.fill();
    context.lineWidth = outline;
    context.strokeStyle = UI_COLORS.ink;
    context.stroke();
  };
  blob(-L * 0.26, L * 0.24, L * 0.19);
  blob(L * 0.0, L * 0.1, L * 0.085);
  blob(L * 0.22, L * 0.16, L * 0.16);

  // мягкий блик на брюшке и голове
  context.fillStyle = UI_COLORS.white;
  context.globalAlpha = 0.35;
  context.beginPath();
  context.ellipse(-L * 0.3, -L * 0.08, L * 0.1, L * 0.05, -0.3, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  // большие глаза, смотрят вперёд: белок, зрачок, блик
  for (const side of [-1, 1]) {
    const x = L * 0.27;
    const y = side * L * 0.082;
    context.fillStyle = UI_COLORS.white;
    context.beginPath();
    context.arc(x, y, L * 0.08, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = Math.max(0.75, outline * 0.6);
    context.strokeStyle = UI_COLORS.ink;
    context.stroke();
    context.fillStyle = UI_COLORS.ink;
    context.beginPath();
    context.arc(x + L * 0.026, y, L * 0.045, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = UI_COLORS.white;
    context.beginPath();
    context.arc(x + L * 0.04, y - L * 0.018, L * 0.016, 0, Math.PI * 2);
    context.fill();
  }
}

/** Заготовленные кадры: 8 цветов × 4 направления × 3 кадра в одном offscreen canvas. */
export class AntAtlas {
  private readonly canvas: HTMLCanvasElement;
  /** Сторона клетки атласа в пикселях устройства. */
  private readonly cell: number;
  /** Сторона клетки в CSS px. */
  readonly size: number;

  constructor(
    /** Длина муравья в CSS px. */
    readonly length: number,
    readonly ratio: number,
  ) {
    this.size = Math.ceil(length * BOX);
    this.cell = Math.ceil(this.size * ratio);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.cell * DIRECTIONS.length * FRAMES;
    this.canvas.height = this.cell * GAME_COLORS.length;
    const context = this.canvas.getContext('2d')!;
    GAME_COLORS.forEach((color, row) => {
      DIRECTIONS.forEach((_, turn) => {
        for (let frame = 0; frame < FRAMES; frame++) {
          const column = turn * FRAMES + frame;
          context.save();
          context.translate((column + 0.5) * this.cell, (row + 0.5) * this.cell);
          context.scale(ratio, ratio);
          context.rotate((turn * Math.PI) / 2);
          drawCartoonAnt(context, color.hex, length, frame);
          context.restore();
        }
      });
    });
  }

  /** Нарисовать муравья с центром в (x, y), CSS px. */
  draw(context: CanvasRenderingContext2D, color: number, direction: Direction, frame: number, x: number, y: number): void {
    const column = DIRECTIONS.indexOf(direction) * FRAMES + frame;
    const half = this.size / 2;
    context.drawImage(
      this.canvas,
      column * this.cell,
      color * this.cell,
      this.cell,
      this.cell,
      x - half,
      y - half,
      this.size,
      this.size,
    );
  }
}

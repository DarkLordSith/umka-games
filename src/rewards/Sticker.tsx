// Наклейка: SVG из частей stickers.ts. Сначала белая «вырезка» по контуру всех частей
// (как у настоящей наклейки), сверху — сами части с тёмным контуром.
// silhouette — блёклый силуэт для пустого места в альбоме (что здесь появится).
import type { ReactElement } from 'react';
import { recolor, type StickerColor, type StickerPart, stickerAt } from './stickers';

/** Толщина белой обводки, в единицах viewBox (0…100). */
const OUTLINE = 12;
const INK_STROKE = 3;

function fillOf(color: StickerColor): string {
  return color === 'white' ? 'var(--white)' : color === 'ink' ? 'var(--ink)' : `var(--game-${color})`;
}

interface PaintProps {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

function shape(part: StickerPart, key: number, paint: PaintProps, extraLine = 0): ReactElement {
  const common = { fill: paint.fill, stroke: paint.stroke, strokeWidth: paint.strokeWidth, strokeLinejoin: 'round' as const };
  switch (part.kind) {
    case 'circle':
      return <circle key={key} cx={part.cx} cy={part.cy} r={part.r} {...common} />;
    case 'ellipse':
      return (
        <ellipse
          key={key}
          cx={part.cx}
          cy={part.cy}
          rx={part.rx}
          ry={part.ry}
          transform={part.rotate ? `rotate(${part.rotate} ${part.cx} ${part.cy})` : undefined}
          {...common}
        />
      );
    case 'rect':
      return <rect key={key} x={part.x} y={part.y} width={part.w} height={part.h} rx={part.r ?? 0} {...common} />;
    case 'path':
      return <path key={key} d={part.d} {...common} />;
    case 'line':
      return (
        <path
          key={key}
          d={part.d}
          fill="none"
          stroke={paint.stroke === 'none' ? paint.fill : paint.stroke}
          strokeWidth={part.width + extraLine}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}

export interface StickerProps {
  /** Номер наклейки (с 0). */
  readonly id: number;
  readonly silhouette?: boolean;
}

export function Sticker({ id, silhouette = false }: StickerProps) {
  const { design, variant } = stickerAt(id);
  const outline = design.parts.map((part, index) =>
    shape(
      part,
      index,
      silhouette
        ? { fill: 'var(--panel)', stroke: 'var(--panel)', strokeWidth: OUTLINE }
        : { fill: 'var(--white)', stroke: 'var(--white)', strokeWidth: OUTLINE },
      OUTLINE,
    ),
  );
  return (
    <svg
      viewBox="-8 -8 116 116"
      width="100%"
      height="100%"
      className={silhouette ? 'sticker is-silhouette' : 'sticker'}
      aria-hidden="true"
    >
      <g>{outline}</g>
      {silhouette ? null : (
        <g>
          {design.parts.map((part, index) => {
            const color = fillOf(recolor(part.color, variant));
            return part.kind === 'line'
              ? shape(part, index, { fill: color, stroke: color, strokeWidth: 0 })
              : shape(part, index, { fill: color, stroke: 'var(--ink)', strokeWidth: INK_STROKE });
          })}
        </g>
      )}
    </svg>
  );
}

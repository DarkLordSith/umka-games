// npm run icons — иконки PWA из SVG: public/icons/{icon.svg, icon-192.png,
// icon-512.png, icon-maskable-512.png, apple-touch-icon.png}.
// Временная абстрактная иконка: «конфетный» блок со звездой (не медвежонок).
// Цвета — из src/ui/palette.ts. PNG рендерит @resvg/resvg-js (без браузера и системных библиотек).
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { GAME_COLORS, SHADOW, UI_COLORS } from '../src/ui/palette.ts';

const OUT = new URL('../public/icons/', import.meta.url);

const hex = (id: string): string => {
  const color = GAME_COLORS.find(entry => entry.id === id);
  if (!color) {
    throw new Error(`нет цвета ${id} в палитре`);
  }
  return color.hex;
};

/** Пятиконечная звезда с центром (cx, cy). */
function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
  }
  return `M${points.join('L')}Z`;
}

/**
 * Иконка на холсте 512×512. scale — доля холста под блок: для maskable
 * блок меньше, чтобы уместиться в безопасный круг (80% диаметра).
 */
function iconSvg(scale: number): string {
  const size = 512 * scale;
  const x = (512 - size) / 2;
  const y = (512 - size) / 2 - size * 0.03;
  const radius = size * 0.24;
  const depth = size * 0.07;
  const cx = 256;
  const cy = y + size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${UI_COLORS.sky}"/>
  <rect x="${x}" y="${y + depth * 1.6}" width="${size}" height="${size}" rx="${radius}" fill="${SHADOW}"/>
  <rect x="${x}" y="${y + depth}" width="${size}" height="${size}" rx="${radius}" fill="${hex('purple')}"/>
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${hex('pink')}"/>
  <rect x="${x + size * 0.12}" y="${y + size * 0.06}" width="${size * 0.26}" height="${size * 0.08}" rx="${size * 0.04}" fill="${UI_COLORS.white}" opacity="0.55"/>
  <path d="${starPath(cx, cy + size * 0.07, size * 0.32, size * 0.15)}" fill="${SHADOW}"/>
  <path d="${starPath(cx, cy + size * 0.04, size * 0.32, size * 0.15)}" fill="${hex('yellow')}" stroke="${UI_COLORS.white}" stroke-width="${size * 0.035}" stroke-linejoin="round"/>
</svg>
`;
}

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

mkdirSync(OUT, { recursive: true });
const regular = iconSvg(0.72);
const maskable = iconSvg(0.58);
writeFileSync(new URL('icon.svg', OUT), regular);
writeFileSync(new URL('icon-192.png', OUT), png(regular, 192));
writeFileSync(new URL('icon-512.png', OUT), png(regular, 512));
writeFileSync(new URL('icon-maskable-512.png', OUT), png(maskable, 512));
writeFileSync(new URL('apple-touch-icon.png', OUT), png(regular, 180));
console.log('иконки записаны в public/icons/');

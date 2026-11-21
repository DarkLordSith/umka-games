// Картинка муравьёв как есть: canvas в размер сетки (1 пиксель = 1 клетка), увеличивает CSS
// без сглаживания. Вписывается в контейнер с сохранением пропорций (object-fit: contain).
// silhouette — все пиксели одним цветом (несобранная наклейка в альбоме).
import { useEffect, useRef } from 'react';
import { GAME_COLORS, UI_COLORS } from '../../ui/palette';
import { EMPTY } from './logic';
import type { Picture } from './pictures';

export interface PictureCell {
  readonly x: number;
  readonly y: number;
  readonly fill: string;
}

/** Закрашенные клетки картинки (чистая функция — её проверяют тесты). */
export function pictureCells(picture: Picture, silhouette = false): PictureCell[] {
  return picture.pixels.flatMap((value, index) =>
    value === EMPTY
      ? []
      : [
          {
            x: index % picture.width,
            y: Math.floor(index / picture.width),
            fill: silhouette ? UI_COLORS.silhouette : GAME_COLORS[value]!.hex,
          },
        ],
  );
}

export function PictureCanvas({ picture, silhouette = false }: { readonly picture: Picture; readonly silhouette?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = picture.width;
    canvas.height = picture.height;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, picture.width, picture.height);
    for (const cell of pictureCells(picture, silhouette)) {
      context.fillStyle = cell.fill;
      context.fillRect(cell.x, cell.y, 1, 1);
    }
  }, [picture, silhouette]);

  // вписана в контейнер любой формы: canvas во весь контейнер, картинка — по object-fit
  return (
    <canvas
      ref={ref}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
    />
  );
}

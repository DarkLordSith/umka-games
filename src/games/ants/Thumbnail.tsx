// Превью уровня для карты: картинка, которую съедят (съели) муравьи, — без обводки, так красивее.
// Canvas в размер сетки (1 пиксель = 1 клетка), увеличивает CSS без сглаживания.
import { useEffect, useRef } from 'react';
import type { LevelSpec } from '../../engine/types';
import { GAME_COLORS } from '../../ui/palette';
import { pictureFor } from './generator';
import { EMPTY } from './logic';

export function AntsThumbnail({ level }: { readonly level: LevelSpec }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const picture = pictureFor(level);

  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = picture.width;
    canvas.height = picture.height;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, picture.width, picture.height);
    picture.pixels.forEach((value, index) => {
      if (value !== EMPTY) {
        context.fillStyle = GAME_COLORS[value]!.hex;
        context.fillRect(index % picture.width, Math.floor(index / picture.width), 1, 1);
      }
    });
  }, [picture]);

  // ширина/высота по пропорциям сетки: прямоугольные картинки не растягиваются
  const long = Math.max(picture.width, picture.height);
  return (
    <canvas
      ref={ref}
      style={{
        width: `${(picture.width / long) * 100}%`,
        height: `${(picture.height / long) * 100}%`,
        imageRendering: 'pixelated',
      }}
    />
  );
}

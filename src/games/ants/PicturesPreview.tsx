// Превью картинок для отбраковки (только dev, ?dev=pictures): все картинки сеткой
// с id и размером сетки; справа от каждой — она же с чёрной обводкой (как с 4-го уровня).
// Текст здесь можно: это экран для владельца, не для ребёнка.
import { useEffect, useRef } from 'react';
import { GAME_COLORS, UI_COLORS } from '../../ui/palette';
import { outlinePicture } from './generator';
import { EMPTY } from './logic';
import { type Picture, PICTURES } from './pictures';

/** Сторона картинки в превью, CSS px. */
const BOX = 72;

function PictureCanvas({ picture }: { readonly picture: Picture }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const cell = Math.floor((BOX * ratio) / Math.max(picture.width, picture.height));
    canvas.width = cell * picture.width;
    canvas.height = cell * picture.height;
    canvas.style.width = `${canvas.width / ratio}px`;
    canvas.style.height = `${canvas.height / ratio}px`;
    const context = canvas.getContext('2d')!;
    context.fillStyle = UI_COLORS.panel;
    context.fillRect(0, 0, canvas.width, canvas.height);
    picture.pixels.forEach((value, index) => {
      if (value !== EMPTY) {
        context.fillStyle = GAME_COLORS[value]!.hex;
        context.fillRect((index % picture.width) * cell, Math.floor(index / picture.width) * cell, cell, cell);
      }
    });
  }, [picture]);
  return <canvas ref={ref} />;
}

export function PicturesPreview() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        touchAction: 'pan-y',
        padding: 'var(--top-zone) 8px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignContent: 'flex-start',
        color: 'var(--ink)',
        font: '600 11px system-ui',
      }}
    >
      {PICTURES.map((picture, index) => (
        <figure key={picture.id} style={{ margin: 0, display: 'grid', gap: 2, justifyItems: 'start' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            <PictureCanvas picture={picture} />
            <PictureCanvas picture={outlinePicture(picture)} />
          </div>
          <figcaption>
            {index + 1}. {picture.id} · {picture.width}×{picture.height}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

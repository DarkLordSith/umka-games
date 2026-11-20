// Превью наклеек для отбраковки (только dev, ?dev=stickers): все дизайны × варианты
// по номерам, внизу — силуэт пустого места. Текст можно: экран для владельца.
import { Sticker } from './Sticker';
import { DISTINCT_STICKERS, STICKER_DESIGNS } from './stickers';
import './sticker.css';

export function StickersPreview() {
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
        gap: 6,
        alignContent: 'flex-start',
        color: 'var(--ink)',
        font: '600 10px system-ui',
      }}
    >
      {Array.from({ length: DISTINCT_STICKERS }, (_, n) => (
        <figure key={n} style={{ margin: 0, width: 84, display: 'grid', justifyItems: 'center' }}>
          <div style={{ width: 76, height: 76 }}>
            <Sticker id={n} />
          </div>
          <figcaption>
            {n}. {STICKER_DESIGNS[n % STICKER_DESIGNS.length]!.id}
          </figcaption>
        </figure>
      ))}
      <figure style={{ margin: 0, width: 84 }}>
        <div style={{ width: 76, height: 76 }}>
          <Sticker id={0} silhouette />
        </div>
        <figcaption>силуэт</figcaption>
      </figure>
    </div>
  );
}

// Наклейка: картинка игры (GameAlbum.Art) с белой «вырезкой» по контуру и мягкой тенью,
// как у бумажной наклейки. Обводку рисует CSS (drop-shadow по форме картинки) — одинаково
// для любой игры. silhouette — серый силуэт несобранной, без обводки. shiny — блеск повтора.
import type { GameAlbum } from '../engine/types';
import './sticker.css';

export interface StickerArtProps {
  readonly album: GameAlbum;
  readonly variant: string;
  readonly silhouette?: boolean;
}

export function StickerArt({ album, variant, silhouette = false }: StickerArtProps) {
  const { Art } = album;
  return (
    <div className={silhouette ? 'sticker is-silhouette' : 'sticker'} aria-hidden="true">
      <Art variant={variant} silhouette={silhouette} />
    </div>
  );
}

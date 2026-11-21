// Альбом наклеек — коллекция без повторов: по месту на каждый вариант каждой игры
// (у муравьёв — каждая картинка). Собранные — наклейка с белой обводкой, собранная 2+ раза —
// с золотистым блеском рамки; несобранные — серый силуэт («найди все»). Коллекция
// выводится из пройденных уровней (engine/collection), отдельно не хранится.
// Страницы по 20 мест (4 × 5) идут по играм подряд и листаются свайпом. Без текста и цифр.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../audio/useAudio';
import { collectionCounts } from '../engine/collection';
import { gameProgress, type Progress } from '../engine/progress';
import type { GameAlbum, GameModule } from '../engine/types';
import { HomeIcon } from '../ui/icons';
import { StickerArt } from './StickerArt';
import './album.css';

/** Мест на странице: 4 × 5. */
export const PER_PAGE = 20;

interface AlbumPage {
  readonly gameId: string;
  readonly album: GameAlbum;
  readonly slots: readonly { readonly variant: string; readonly count: number }[];
}

/** Страницы альбома: игры с album по порядку, у каждой — свои страницы по PER_PAGE мест. */
export function albumPages(games: readonly Pick<GameModule<unknown, unknown>, 'id' | 'album' | 'startDifficulty'>[], progress: Progress): AlbumPage[] {
  return games.flatMap(game => {
    const album = game.album;
    if (!album) {
      return [];
    }
    const counts = collectionCounts(album, gameProgress(progress, game.id, game.startDifficulty).levels);
    const slots = album.variants.map(variant => ({ variant, count: counts.get(variant) ?? 0 }));
    return Array.from({ length: Math.ceil(slots.length / PER_PAGE) }, (_, page) => ({
      gameId: game.id,
      album,
      slots: slots.slice(page * PER_PAGE, (page + 1) * PER_PAGE),
    }));
  });
}

export interface AlbumProps {
  readonly games: readonly GameModule<any, any>[];
  readonly progress: Progress;
  readonly onBack: () => void;
}

export function Album({ games, progress, onBack }: AlbumProps) {
  const { sfx, say } = useAudio();
  const pagesRef = useRef<HTMLDivElement>(null);
  const pages = useMemo(() => albumPages(games, progress), [games, progress]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.some(item => item.slots.some(slot => slot.count > 0))) {
      say('album-open');
    }
  }, []);

  useEffect(() => {
    const element = pagesRef.current!;
    const onScroll = () => setPage(Math.round(element.scrollLeft / Math.max(1, element.clientWidth)));
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  const jump = (element: HTMLElement) => {
    sfx.hop();
    element.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-18px) scale(1.14) rotate(-6deg)', offset: 0.4 },
        { transform: 'translateY(0) scale(0.94, 1.06)', offset: 0.75 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 480, easing: 'ease-out' },
    );
  };

  return (
    <div className="album">
      <div className="sky" aria-hidden="true" />
      <div ref={pagesRef} className="album-pages">
        {pages.map((item, pageIndex) => (
          <div key={pageIndex} className="album-page">
            {item.slots.map(({ variant, count }) =>
              count > 0 ? (
                <button
                  key={variant}
                  type="button"
                  className={count > 1 ? 'album-slot is-owned is-shiny' : 'album-slot is-owned'}
                  aria-label={variant}
                  onClick={event => jump(event.currentTarget)}
                >
                  <StickerArt album={item.album} variant={variant} />
                  {count > 1 ? <span className="sticker-shine" aria-hidden="true" /> : null}
                </button>
              ) : (
                <div key={variant} className="album-slot" aria-hidden="true">
                  <StickerArt album={item.album} variant={variant} silhouette />
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="album-dots" aria-hidden="true">
        {pages.map((_, index) => (
          <span key={index} className={index === page ? 'album-dot is-active' : 'album-dot'} />
        ))}
      </div>
      <button type="button" className="album-home" aria-label="назад" onClick={onBack}>
        <HomeIcon />
      </button>
    </div>
  );
}

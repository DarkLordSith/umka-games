// Альбом наклеек: страницы по 12 мест листаются свайпом (нативная прокрутка со «щелчком»
// по страницам). Полученные наклейки — яркие, следующие места — блёклые силуэты того,
// что там появится. Тап по наклейке — прыжок со звуком. Без текста: внизу точки страниц.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAudio } from '../audio/useAudio';
import { nextSticker } from '../engine/progress';
import type { Progress } from '../engine/progress';
import { HomeIcon } from '../ui/icons';
import { Sticker } from './Sticker';
import './album.css';
import './sticker.css';

/** Мест на странице: 3 × 4. */
export const PER_PAGE = 12;

export interface AlbumProps {
  readonly progress: Progress;
  readonly onBack: () => void;
}

export function Album({ progress, onBack }: AlbumProps) {
  const { sfx, say } = useAudio();
  const pagesRef = useRef<HTMLDivElement>(null);
  const { stickers } = progress;
  // страниц — чтобы поместились все наклейки и хотя бы одно пустое место впереди
  const pageCount = Math.max(1, Math.ceil((stickers.length + 1) / PER_PAGE));
  const lastPage = Math.max(0, Math.ceil(stickers.length / PER_PAGE) - 1);
  const [page, setPage] = useState(lastPage);
  const upcoming = nextSticker(progress);

  // открываем на странице с последней наклейкой
  useLayoutEffect(() => {
    const pages = pagesRef.current!;
    pages.scrollLeft = lastPage * pages.clientWidth;
  }, []);

  useEffect(() => {
    if (stickers.length > 0) {
      say('album-open');
    }
  }, []);

  useEffect(() => {
    const pages = pagesRef.current!;
    const onScroll = () => setPage(Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)));
    pages.addEventListener('scroll', onScroll, { passive: true });
    return () => pages.removeEventListener('scroll', onScroll);
  }, []);

  const jump = (element: HTMLElement) => {
    sfx.hop();
    element.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-22px) scale(1.12) rotate(-6deg)', offset: 0.4 },
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
        {Array.from({ length: pageCount }, (_, pageIndex) => (
          <div key={pageIndex} className="album-page">
            {Array.from({ length: PER_PAGE }, (_, slot) => {
              const index = pageIndex * PER_PAGE + slot;
              const owned = index < stickers.length;
              const id = owned ? stickers[index]! : upcoming + (index - stickers.length);
              return owned ? (
                <button
                  key={slot}
                  type="button"
                  className="album-slot is-owned"
                  aria-label={String(index + 1)}
                  onClick={event => jump(event.currentTarget)}
                >
                  <Sticker id={id} />
                </button>
              ) : (
                <div key={slot} className="album-slot" aria-hidden="true">
                  <Sticker id={id} silhouette />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="album-dots" aria-hidden="true">
        {Array.from({ length: pageCount }, (_, index) => (
          <span key={index} className={index === page ? 'album-dot is-active' : 'album-dot'} />
        ))}
      </div>
      <button type="button" className="album-home" aria-label="назад" onClick={onBack}>
        <HomeIcon />
      </button>
    </div>
  );
}

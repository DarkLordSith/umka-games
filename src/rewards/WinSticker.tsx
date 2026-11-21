// Наклейка за уровень на экране победы: картинка «отклеивается» с поля (белая обводка,
// наклон, тень), звучит голос, наклейка летит в иконку альбома, та подпрыгивает —
// и только тогда оболочка показывает «Дальше». Касания проходят сквозь и ничего не ломают.
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useAudio } from '../audio/useAudio';
import type { StickerReward } from '../engine/collection';
import type { GameAlbum } from '../engine/types';
import { StickerArt } from './StickerArt';

/** Экран игры помечает элемент собранной картинки этим атрибутом — наклейка отклеится оттуда. */
export const STICKER_SOURCE_ATTR = 'data-sticker-source';

const PEEL_MS = 650;
/** Подержать перед полётом: новая — услышать «Новая наклейка!», повтор — увидеть блеск. */
const HOLD_NEW_MS = 900;
const HOLD_REPEAT_MS = 1_300;
const FLY_MS = 700;
/** Нет картинки на экране — наклейка такого размера по центру. */
const FALLBACK = 200;

export interface WinStickerProps {
  readonly album: GameAlbum;
  readonly reward: StickerReward;
  /** Где искать картинку (элемент с STICKER_SOURCE_ATTR) и относительно чего ставить наклейку. */
  readonly stage: RefObject<HTMLElement | null>;
  /** Куда лететь — иконка альбома. */
  readonly target: RefObject<HTMLElement | null>;
  readonly onDone: () => void;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

export function WinSticker({ album, reward, stage, target, onDone }: WinStickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { sfx, say, sayFrom } = useAudio();
  const [box] = useState<Box>(() => {
    const root = stage.current?.getBoundingClientRect();
    const source = stage.current?.querySelector(`[${STICKER_SOURCE_ATTR}]`)?.getBoundingClientRect();
    if (root && source && source.width > 0) {
      const size = Math.min(source.width, source.height);
      return {
        left: source.left - root.left + (source.width - size) / 2,
        top: source.top - root.top + (source.height - size) / 2,
        size,
      };
    }
    const width = root?.width ?? FALLBACK * 2;
    const height = root?.height ?? FALLBACK * 2;
    return { left: (width - FALLBACK) / 2, top: (height - FALLBACK) / 2.6, size: FALLBACK };
  });
  const [shiny, setShiny] = useState(false);

  useEffect(() => {
    const sticker = ref.current!;
    let cancelled = false;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(() => !cancelled && run(), ms));

    // отклеивание: приподнимается, наклоняется, чуть уменьшается
    sfx.hop();
    if (reward.isNew) {
      say('sticker-new');
    } else {
      sayFrom('praise');
      setShiny(true);
    }
    const lifted = 'translate(0, -14px) scale(0.82) rotate(-7deg)';
    sticker.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0)' },
        { transform: 'translate(0, -26px) scale(0.9) rotate(4deg)', offset: 0.55 },
        { transform: lifted },
      ],
      { duration: PEEL_MS, easing: 'ease-out', fill: 'forwards' },
    );

    later(PEEL_MS + (reward.isNew ? HOLD_NEW_MS : HOLD_REPEAT_MS), () => {
      const goal = target.current?.getBoundingClientRect();
      const root = stage.current?.getBoundingClientRect();
      if (!goal || !root) {
        onDone();
        return;
      }
      const dx = goal.left - root.left + goal.width / 2 - (box.left + box.size / 2);
      const dy = goal.top - root.top + goal.height / 2 - (box.top + box.size / 2);
      const scale = (Math.min(goal.width, goal.height) * 0.6) / box.size;
      sticker
        .animate(
          [
            { transform: lifted, opacity: 1 },
            {
              transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 80}px) scale(${(0.82 + scale) / 2}) rotate(-14deg)`,
              opacity: 1,
              offset: 0.5,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0)`, opacity: 0.3 },
          ],
          { duration: FLY_MS, easing: 'ease-in', fill: 'forwards' },
        )
        .finished.then(() => {
          if (cancelled) {
            return;
          }
          sfx.place();
          target.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.3) rotate(-8deg)' }, { transform: 'scale(1)' }],
            { duration: 420, easing: 'ease-out' },
          );
          sticker.style.visibility = 'hidden';
          onDone();
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={shiny ? 'win-sticker is-shiny' : 'win-sticker'}
      style={{ left: box.left, top: box.top, width: box.size, height: box.size }}
    >
      <div className="sticker-glow">
        <StickerArt album={album} variant={reward.variant} />
      </div>
    </div>
  );
}

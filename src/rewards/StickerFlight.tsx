// Новая наклейка: появляется крупно над картой («Новая наклейка!»), держится,
// потом улетает в иконку альбома и та подпрыгивает. Касания проходят сквозь.
import { type RefObject, useEffect, useRef } from 'react';
import { useAudio } from '../audio/useAudio';
import { Sticker } from './Sticker';
import './sticker.css';

const SIZE = 168;
const POP_MS = 450;
const HOLD_MS = 900;
const FLY_MS = 650;

export interface StickerFlightProps {
  readonly id: number;
  /** Куда лететь — иконка альбома. */
  readonly target: RefObject<HTMLElement | null>;
  readonly onDone: () => void;
}

export function StickerFlight({ id, target, onDone }: StickerFlightProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { sfx, say } = useAudio();

  useEffect(() => {
    const sticker = ref.current!;
    say('sticker-new');
    sfx.win();
    const pop = sticker.animate(
      [
        { transform: 'scale(0.2) rotate(-20deg)', opacity: 0 },
        { transform: 'scale(1.15) rotate(6deg)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1) rotate(0)', opacity: 1 },
      ],
      { duration: POP_MS, easing: 'ease-out', fill: 'forwards' },
    );
    let cancelled = false;
    const fly = window.setTimeout(() => {
      const box = sticker.getBoundingClientRect();
      const goal = target.current?.getBoundingClientRect();
      if (!goal) {
        onDone();
        return;
      }
      const dx = goal.left + goal.width / 2 - (box.left + box.width / 2);
      const dy = goal.top + goal.height / 2 - (box.top + box.height / 2);
      const scale = Math.min(goal.width, goal.height) / SIZE;
      pop.cancel();
      sticker
        .animate(
          [
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(${(1 + scale) / 2}) rotate(-10deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.2 },
          ],
          { duration: FLY_MS, easing: 'ease-in', fill: 'forwards' },
        )
        .finished.then(() => {
          if (cancelled) {
            return;
          }
          sfx.place();
          target.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-8deg)' }, { transform: 'scale(1)' }],
            { duration: 420, easing: 'ease-out' },
          );
          onDone();
        })
        .catch(() => {});
    }, POP_MS + HOLD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(fly);
    };
  }, []);

  return (
    <div className="sticker-flight" aria-hidden="true">
      <div ref={ref} style={{ width: SIZE, height: SIZE }}>
        <Sticker id={id} />
      </div>
    </div>
  );
}

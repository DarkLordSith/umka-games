import { type CSSProperties, useMemo } from 'react';
import { mulberry32 } from '../engine/rng';
import { GAME_COLORS } from './palette';
import './confetti.css';

const PIECES = 48;

/** CSS-конфетти на весь экран. Касания проходят сквозь. */
export function Confetti({ seed = 1 }: { seed?: number }) {
  const pieces = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: PIECES }, (_, index) => ({
      id: index,
      style: {
        '--x': `${rng() * 100}vw`,
        '--drift': `${(rng() - 0.5) * 30}vw`,
        '--spin': `${360 + rng() * 720}deg`,
        '--delay': `${rng() * 0.6}s`,
        '--time': `${1.8 + rng() * 1.4}s`,
        '--size': `${8 + rng() * 8}px`,
        background: `var(--game-${GAME_COLORS[index % GAME_COLORS.length]!.id})`,
      } as CSSProperties,
    }));
  }, [seed]);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(piece => (
        <i key={piece.id} style={piece.style} />
      ))}
    </div>
  );
}

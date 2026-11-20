// Рука-подсказка: показывает, куда нажать. Без текста — только жест «тук-тук».
import type { CSSProperties } from 'react';
import './hint-hand.css';

export interface HintHandProps {
  /** Точка касания (кончик пальца) в px относительно ближайшего position: relative/absolute. */
  readonly x: number;
  readonly y: number;
}

export function HintHand({ x, y }: HintHandProps) {
  return (
    <div className="hint-hand" style={{ left: x, top: y } as CSSProperties} aria-hidden="true">
      <span className="hint-hand-ripple" />
      <svg className="hint-hand-svg" viewBox="0 0 64 80" width="56" height="70">
        {/* указательный палец вверх, ладонь снизу; кончик пальца — в (22, 4) */}
        <path
          d="M17 8 a5 5 0 0 1 10 0 V34 l3 -9 a5 5 0 0 1 9 3 l-1 6 l2 -5 a5 5 0 0 1 9 3 l-1 6 l2 -3 a5 5 0 0 1 8 4 L54 54 C52 68 44 76 32 76 C20 76 12 68 10 58 L6 44 a5 5 0 0 1 9 -4 L17 46 Z"
          fill="var(--white)"
          stroke="var(--ink)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

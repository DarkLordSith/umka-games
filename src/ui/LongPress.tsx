// Кнопка «долгим нажатием»: держишь — по краю бежит кольцо, через duration мс срабатывает.
// Отпустил раньше — кольцо откатывается, ничего не происходит. Защита от случайного выхода.
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import './long-press.css';

export interface LongPressProps {
  /** Сколько держать, мс. */
  readonly duration: number;
  readonly onComplete: () => void;
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function LongPress({ duration, onComplete, label, className, children }: LongPressProps) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef(0);

  const cancel = () => {
    window.clearTimeout(timer.current);
    setPressing(false);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      aria-label={label}
      className={`long-press ${pressing ? 'is-pressing' : ''} ${className ?? ''}`}
      style={{ '--hold': `${duration}ms` } as CSSProperties}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setPressing(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          setPressing(false);
          onComplete();
        }, duration);
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <svg className="long-press-ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" pathLength="100" />
      </svg>
      <span className="long-press-face">{children}</span>
    </button>
  );
}

import { useRef, useState } from 'react';
import { GAME_COLORS } from '../ui/palette';
import './placeholder.css';

/**
 * Экран-заглушка каркаса: фон и крупный яркий круг без текста.
 * Тап — круг сплющивается и меняет цвет (проверка касаний и анимаций на iPhone).
 * Задача ants/screen-mvp заменит его экраном муравьёв.
 */
export function App() {
  const [colorIndex, setColorIndex] = useState(0);
  const circle = useRef<HTMLButtonElement>(null);
  const color = GAME_COLORS[colorIndex % GAME_COLORS.length]!;

  const tap = () => {
    setColorIndex(index => index + 1);
    circle.current?.animate(
      [
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1.18, 0.82)' },
        { transform: 'scale(0.94, 1.06)' },
        { transform: 'scale(1, 1)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  };

  return (
    <>
      <div className="sky" aria-hidden="true" />
      <main className="stage">
        <button
          ref={circle}
          type="button"
          className="placeholder-circle"
          style={{ background: `var(--game-${color.id})` }}
          aria-label="круг"
          onPointerDown={tap}
        />
      </main>
    </>
  );
}

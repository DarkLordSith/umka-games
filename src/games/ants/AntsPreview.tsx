// Превью муравьёв для отбраковки (только dev, ?dev=ants): все цвета × 4 направления,
// крупно и в игровом размере, с анимацией ходьбы.
import { useEffect, useRef } from 'react';
import { GAME_COLORS, UI_COLORS } from '../../ui/palette';
import { AntAtlas, DIRECTIONS, WALK_CYCLE } from './antSprite';
import { ANT_STEP_MS } from './render';

const BIG = 40;
const GAME = 24;

export function AntsPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const big = new AntAtlas(BIG, ratio);
    const game = new AntAtlas(GAME, ratio);
    const cellBig = big.size + 8;
    const cellGame = game.size + 10;
    // сверху крупно, ниже — в игровом размере
    const width = DIRECTIONS.length * cellBig + 24;
    const gameTop = GAME_COLORS.length * cellBig + 36;
    const height = gameTop + GAME_COLORS.length * cellGame + 24;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d')!;
    context.scale(ratio, ratio);
    let frame = 0;
    const draw = (time: number) => {
      context.fillStyle = UI_COLORS.bg;
      context.fillRect(0, 0, width, height);
      const step = WALK_CYCLE[Math.floor(time / ANT_STEP_MS) % WALK_CYCLE.length]!;
      GAME_COLORS.forEach((_, color) => {
        const y = 12 + color * cellBig + cellBig / 2;
        DIRECTIONS.forEach((direction, index) => {
          big.draw(context, color, direction, step, 12 + index * cellBig + cellBig / 2, y);
          game.draw(context, color, direction, step, 12 + index * cellGame + cellGame / 2, gameTop + color * cellGame + cellGame / 2);
        });
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', touchAction: 'pan-y', paddingTop: 'var(--top-zone)' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

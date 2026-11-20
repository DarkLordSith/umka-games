// Экран муравьёв: DOM-раскладка (колонки, слоты, кнопки) + canvas-слой (картинка и муравьи).
// Сверху вниз: фон под статус-баром → картинка → муравейник и 5 слотов → колонки → Undo.
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { canUndo, createHistory, current, type History, push, restart, undo } from '../../engine/history';
import { Confetti } from '../../ui/Confetti';
import { RestartIcon, UndoIcon } from '../../ui/icons';
import { GAME_COLORS } from '../../ui/palette';
import { makeLevel } from './generator';
import { type AntsState, type Block, isStuck, isWon, SLOT_COUNT, tap } from './logic';
import { AntsRenderer, type Layout } from './render';
import './screen.css';

export interface AntsScreenProps {
  /** Номер уровня, с 1. Уровень детерминирован: seed = номер. */
  readonly level: number;
  /** Уровень пройден (оболочка сохраняет прогресс сразу, до празднования). */
  readonly onWin: () => void;
  /** Тап после празднования — следующий уровень. */
  readonly onNext: () => void;
}

/** Полёт блока из колонки в слот, мс. Муравьи стартуют после него. */
const FLIGHT_MS = 240;
/** Сколько блоков под верхним видно приглушённо. */
const PEEK = 3;

const colorVar = (color: number): string => `var(--game-${GAME_COLORS[color]?.id ?? 'red'})`;

function relativeRect(element: Element, root: Element) {
  const box = element.getBoundingClientRect();
  const base = root.getBoundingClientRect();
  return { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height };
}

export function AntsScreen({ level, onWin, onNext }: AntsScreenProps) {
  const start = useMemo(() => makeLevel(level, level), [level]);
  const [history, setHistory] = useState<History<AntsState>>(() => createHistory(start));
  const historyRef = useRef(history);
  historyRef.current = history;
  const state = current(history);
  const won = isWon(state);
  const [celebrating, setCelebrating] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const columnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rendererRef = useRef<AntsRenderer | null>(null);
  const winTimer = useRef(0);
  /** Ключ слота меняется, когда в него встаёт новый блок, — так перезапускается анимация появления. */
  const slotKeys = useRef<number[]>(Array.from({ length: SLOT_COUNT }, () => 0));
  const placements = useRef(0);

  // Раскладка: картинка — самый большой квадрат с целым размером клетки, остальное — из DOM.
  const measure = useCallback(() => {
    const root = rootRef.current;
    const picture = pictureRef.current;
    const hole = holeRef.current;
    const renderer = rendererRef.current;
    if (!root || !picture || !hole || !renderer) {
      return;
    }
    // место под картинку — область без своих отступов (getBoundingClientRect их включает)
    const parent = picture.parentElement!;
    const area = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    const width = area.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = area.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const cells = historyRef.current.snapshots[0]!.width;
    const size = Math.max(cells, Math.floor(Math.min(width, height) / cells) * cells);
    picture.style.width = `${size}px`;
    picture.style.height = `${size}px`;
    const holeRect = relativeRect(hole, root);
    const layout: Layout = {
      picture: relativeRect(picture, root),
      hole: { x: holeRect.x + holeRect.w / 2, y: holeRect.y + holeRect.h / 2 },
      slots: slotRefs.current.map(slot => {
        const rect = slot ? relativeRect(slot, root) : holeRect;
        return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      }),
    };
    const box = root.getBoundingClientRect();
    renderer.resize(box.width, box.height, layout);
  }, []);

  useLayoutEffect(() => {
    const renderer = new AntsRenderer(canvasRef.current!, historyRef.current.snapshots[0]!);
    rendererRef.current = renderer;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rootRef.current!);
    return () => {
      observer.disconnect();
      renderer.destroy();
      rendererRef.current = null;
      window.clearTimeout(winTimer.current);
    };
  }, [measure]);

  const shake = (column: number) => {
    columnRefs.current[column]?.querySelector('.ants-block')?.animate(
      [
        { transform: 'translateX(0) rotate(0)' },
        { transform: 'translateX(-7px) rotate(-6deg)' },
        { transform: 'translateX(7px) rotate(6deg)' },
        { transform: 'translateX(-4px) rotate(-3deg)' },
        { transform: 'translateX(0) rotate(0)' },
      ],
      { duration: 380, easing: 'ease-out' },
    );
  };

  /** Блок «прыгает» из колонки в слот: летит копия, слот проявляется к её прилёту. */
  const fly = (column: number, slot: number, block: Block) => {
    const root = rootRef.current;
    const from = columnRefs.current[column]?.querySelector('.ants-block');
    const to = slotRefs.current[slot];
    if (!root || !from || !to) {
      return;
    }
    const a = relativeRect(from, root);
    const b = relativeRect(to, root);
    const ghost = document.createElement('div');
    ghost.className = 'ants-ghost';
    ghost.style.background = colorVar(block.color);
    ghost.style.left = `${b.x}px`;
    ghost.style.top = `${b.y}px`;
    ghost.style.width = `${b.w}px`;
    ghost.style.height = `${b.h}px`;
    root.appendChild(ghost);
    const dx = a.x + a.w / 2 - (b.x + b.w / 2);
    const dy = a.y + a.h / 2 - (b.y + b.h / 2);
    const scale = a.w / b.w;
    ghost
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 40}px) scale(${(scale + 1) / 2})`, offset: 0.55 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(0, 0) scale(0.9)', opacity: 0 },
        ],
        { duration: FLIGHT_MS + 120, easing: 'ease-in-out' },
      )
      .finished.finally(() => ghost.remove());
  };

  const onColumn = (column: number) => {
    const before = current(historyRef.current);
    if (isWon(before)) {
      return;
    }
    const result = tap(before, column);
    if (!result) {
      if ((before.columns[column]?.length ?? 0) > 0) {
        shake(column);
      }
      return;
    }
    const block = before.columns[column]![0]!;
    slotKeys.current[result.slot] = ++placements.current;
    fly(column, result.slot, block);
    const duration = rendererRef.current?.play(result.state, result.events, FLIGHT_MS) ?? 0;
    const next = push(historyRef.current, result.state);
    historyRef.current = next;
    setHistory(next);
    if (isWon(result.state)) {
      onWin();
      winTimer.current = window.setTimeout(() => {
        rendererRef.current?.showWin(start.pixels);
        setCelebrating(true);
      }, duration + 150);
    }
  };

  const jump = (next: History<AntsState>) => {
    window.clearTimeout(winTimer.current);
    historyRef.current = next;
    setHistory(next);
    rendererRef.current?.reset(current(next));
  };

  // для скриншотов и ручной проверки в dev: window.__ants
  useEffect(() => {
    if (import.meta.env.DEV) {
      Object.assign(window, { __ants: { state: () => current(historyRef.current), tap: onColumn } });
    }
  });

  const stuck = isStuck(state);

  return (
    <div className="ants" ref={rootRef}>
      <div className="sky" aria-hidden="true" />
      <div className="ants-picture-area">
        <div className="ants-picture" ref={pictureRef} />
      </div>
      <div className="ants-nest">
        <div className="ants-hole" ref={holeRef} />
        <div className="ants-slots">
          {state.slots.map((slot, index) => (
            <div
              key={slot ? `s${index}-${slotKeys.current[index]}` : `e${index}`}
              ref={element => {
                slotRefs.current[index] = element;
              }}
              className={slot ? 'ants-slot is-full' : 'ants-slot'}
              style={slot ? ({ '--block': colorVar(slot.color), '--delay': `${FLIGHT_MS}ms` } as CSSProperties) : undefined}
            >
              {slot ? <span className="ants-count">{slot.left}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="ants-columns">
        {state.columns.map((blocks, index) => (
          <button
            key={index}
            type="button"
            className="ants-column"
            ref={element => {
              columnRefs.current[index] = element;
            }}
            aria-label={`колонка ${index + 1}`}
            disabled={blocks.length === 0}
            onPointerDown={() => onColumn(index)}
          >
            {blocks.slice(1, 1 + PEEK).map((block, depth) => (
              <span
                key={`p${depth}`}
                className="ants-peek"
                style={{ background: colorVar(block.color), '--depth': depth + 1 } as CSSProperties}
              />
            ))}
            {blocks[0] ? (
              <span className="ants-block" style={{ background: colorVar(blocks[0].color) }}>
                <span className="ants-count">{blocks[0].ants}</span>
              </span>
            ) : (
              <span className="ants-empty" />
            )}
          </button>
        ))}
      </div>
      <div className="ants-bar">
        <button
          type="button"
          className="ants-restart"
          aria-label="заново"
          disabled={won || !canUndo(history)}
          onPointerDown={() => jump(restart(historyRef.current))}
        >
          <RestartIcon />
        </button>
        <button
          type="button"
          className={stuck ? 'ants-undo is-pulsing' : 'ants-undo'}
          aria-label="назад"
          disabled={won || !canUndo(history)}
          onPointerDown={() => jump(undo(historyRef.current))}
        >
          <UndoIcon />
        </button>
      </div>
      <canvas className="ants-canvas" ref={canvasRef} />
      {celebrating ? (
        <button type="button" className="ants-win" aria-label="дальше" onPointerDown={onNext}>
          <Confetti seed={level} />
        </button>
      ) : null}
    </div>
  );
}

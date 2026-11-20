// Экран муравьёв: DOM-раскладка (колонки, слоты, кнопки) + canvas-слой (картинка и муравьи).
// Сверху вниз: фон под статус-баром → картинка → муравейник и 5 слотов →
// стопки блоков до нижнего края экрана; справа от стопок — «заново» и Undo.
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { canUndo, createHistory, current, type History, push, restart, undo } from '../../engine/history';
import { Confetti } from '../../ui/Confetti';
import { RestartIcon, UndoIcon } from '../../ui/icons';
import { GAME_COLORS } from '../../ui/palette';
import { makeLevel } from './generator';
import { type AntsState, type Block, isStuck, isWon, SLOT_COUNT, tap } from './logic';
import { AntsRenderer, type Layout } from './render';
import { antHome, antLeft, placeBlock, type SlotsView, viewFromSlots } from './slotView';
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
/** Сколько блоков колонки рендерим: 3 видно, 4-й ждёт за верхом нижней полосы. */
const STACK_RENDERED = 4;
/** Выезд колонки вверх, когда забрали верхний блок, мс. */
const STACK_SLIDE_MS = 220;

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

  /** Метка блока в каждом логическом слоте: номер установки. */
  const slotTags = useRef<number[]>(Array.from({ length: SLOT_COUNT }, () => 0));
  const placements = useRef(0);
  /** Что показывают слоты (отстаёт от логики, пока бегут муравьи). */
  const [slotsView, setSlotsView] = useState<SlotsView>(() => viewFromSlots(start.slots, slotTags.current));

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const holeRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lengths = useRef<number[]>(start.columns.map(column => column.length));
  const rendererRef = useRef<AntsRenderer | null>(null);

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
      holeSize: { w: holeRect.w, h: holeRect.h },
      slots: slotRefs.current.map(slot => {
        const rect = slot ? relativeRect(slot, root) : holeRect;
        return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      }),
    };
    const box = root.getBoundingClientRect();
    renderer.resize(box.width, box.height, layout);
  }, []);

  useLayoutEffect(() => {
    const renderer = new AntsRenderer(canvasRef.current!, historyRef.current.snapshots[0]!, {
      onLeave: (slot, tag) => setSlotsView(view => antLeft(view, slot, tag)),
      onHome: (slot, tag) => setSlotsView(view => antHome(view, slot, tag)),
    });
    rendererRef.current = renderer;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rootRef.current!);
    return () => {
      observer.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [measure]);

  /** Где стоял каждый блок стопки (offsetTop по ключу «колонка:место от дна») — для выезда вверх. */
  const blockTops = useRef(new Map<string, number>());

  // Колонка стала короче — стопка выезжает вверх: каждый блок едет со своего старого места
  // на новое (FLIP), снизу из-за края экрана появляется новый. Undo и «заново» — без анимации.
  useLayoutEffect(() => {
    const tops = new Map<string, number>();
    state.columns.forEach((blocks, index) => {
      const shorter = blocks.length < (lengths.current[index] ?? blocks.length);
      const stack = stackRefs.current[index];
      if (!stack) {
        return;
      }
      const items = [...stack.querySelectorAll<HTMLElement>('[data-place]')];
      const step = items.length > 1 ? items[1]!.offsetTop - items[0]!.offsetTop : 0;
      for (const item of items) {
        const id = `${index}:${item.dataset.place}`;
        const top = item.offsetTop;
        tops.set(id, top);
        if (!shorter) {
          continue;
        }
        const from = blockTops.current.get(id) ?? top + step;
        if (from !== top) {
          item.animate([{ translate: `0 ${from - top}px` }, { translate: '0 0' }], {
            duration: STACK_SLIDE_MS,
            easing: 'cubic-bezier(0.3, 1.4, 0.5, 1)',
          });
        }
      }
    });
    blockTops.current = tops;
    lengths.current = state.columns.map(column => column.length);
  }, [state]);

  /** Тап по блоку из очереди: хода нет, верхний блок подпрыгивает — «бери меня». */
  const nudge = (column: number) => {
    columnRefs.current[column]?.querySelector('.ants-block')?.animate(
      [
        { translate: '0 0' },
        { translate: '0 -14px' },
        { translate: '0 0' },
        { translate: '0 -6px' },
        { translate: '0 0' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  };

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
    ghost
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${a.w / b.w}, ${a.h / b.h})` },
          { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 40}px) scale(1.1)`, offset: 0.55 },
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
    const tag = ++placements.current;
    slotTags.current[result.slot] = tag;
    fly(column, result.slot, block);
    setSlotsView(view => placeBlock(view, result.slot, tag, block.color, block.ants));
    // события слота принадлежат блоку, который в нём сейчас стоит
    const events = result.events.map(event => ({ ...event, tag: slotTags.current[event.slot] ?? 0 }));
    rendererRef.current?.play(result.state, events, FLIGHT_MS);
    const next = push(historyRef.current, result.state);
    historyRef.current = next;
    setHistory(next);
    if (isWon(result.state)) {
      onWin();
      rendererRef.current?.whenIdle(() => {
        rendererRef.current?.showWin(start.pixels);
        setCelebrating(true);
      });
    }
  };

  const jump = (next: History<AntsState>) => {
    historyRef.current = next;
    setHistory(next);
    const state = current(next);
    // у блоков в слотах — новые метки: хвост муравьёв прошлого больше ничего не меняет
    slotTags.current = state.slots.map(slot => (slot ? ++placements.current : 0));
    setSlotsView(viewFromSlots(state.slots, slotTags.current));
    rendererRef.current?.reset(state);
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
          {slotsView.map((slot, index) => (
            <div
              key={slot ? `s${slot.tag}` : `e${index}`}
              ref={element => {
                slotRefs.current[index] = element;
              }}
              className={slot ? 'ants-slot is-full' : 'ants-slot'}
              style={slot ? ({ '--block': colorVar(slot.color), '--delay': `${FLIGHT_MS}ms` } as CSSProperties) : undefined}
            >
              {slot && slot.left > 0 ? <span className="ants-count">{slot.left}</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="ants-columns">
          {state.columns.map((blocks, index) => (
            <div
              key={index}
              className="ants-column"
              ref={element => {
                columnRefs.current[index] = element;
              }}
            >
              <div
                className="ants-stack"
                ref={element => {
                  stackRefs.current[index] = element;
                }}
              >
                {blocks.length === 0 ? <span className="ants-empty" /> : null}
                {blocks.slice(0, STACK_RENDERED).map((block, depth) => {
                  // место от дна колонки: при выезде вверх блок узнаётся по нему
                  const place = blocks.length - depth;
                  const face = (
                    <span
                      className={depth === 0 ? 'ants-block is-top' : 'ants-block is-queued'}
                      style={{ background: colorVar(block.color) }}
                    >
                      <span className="ants-count">{block.ants}</span>
                    </span>
                  );
                  // ход — только тап по верхнему блоку; зона касания — блок с запасом (≥ 60 pt)
                  return depth === 0 ? (
                    <button
                      key={place}
                      data-place={place}
                      type="button"
                      className="ants-top"
                      aria-label={`колонка ${index + 1}`}
                      onPointerDown={() => onColumn(index)}
                    >
                      {face}
                    </button>
                  ) : (
                    <span key={place} data-place={place} className="ants-queued" onPointerDown={() => nudge(index)}>
                      {face}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      {/* нижняя полоса: стопки уходят за её верх; «заново» — в левом углу, Undo — в правом */}
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

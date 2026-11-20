// Экран муравьёв: DOM-раскладка (колонки, слоты, кнопки) + canvas-слой (картинка и муравьи).
// Сверху вниз: фон под статус-баром → картинка → муравейник и 5 слотов →
// стопки (3 ряда) → пустая зона внизу (--chrome-bottom): там кнопки оболочки — Undo, «заново», домик.
//
// Экран по контракту (engine/types.ts): состояние, Undo, подсказку и победу ведёт оболочка.
// Экран только анимирует: свой ход он узнаёт по pending (колонка, которую тапнули),
// любое другое изменение state (Undo, «заново») — мгновенный сброс картинки.
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameScreenProps } from '../../engine/types';
import { HintHand } from '../../ui/HintHand';
import { GAME_COLORS } from '../../ui/palette';
import { type AntsMove, type AntsState, type Block, SLOT_COUNT, tap } from './logic';
import { AntsRenderer, type Layout } from './render';
import { antHome, antLeft, placeBlock, type SlotsView, viewFromSlots } from './slotView';
import './screen.css';

export type AntsScreenProps = GameScreenProps<AntsState, AntsMove>;

/** Полёт блока из колонки в слот, мс. Муравьи стартуют после него. */
const FLIGHT_MS = 240;
/** Сколько блоков колонки рендерим: 3 видно целиком, 4-й растворяется в «тумане», 5-й ждёт ниже. */
const STACK_RENDERED = 5;
/** Выезд колонки вверх, когда забрали верхний блок, мс. */
const STACK_SLIDE_MS = 220;

const colorVar = (color: number): string => `var(--game-${GAME_COLORS[color]?.id ?? 'red'})`;

function relativeRect(element: Element, root: Element) {
  const box = element.getBoundingClientRect();
  const base = root.getBoundingClientRect();
  return { x: box.left - base.left, y: box.top - base.top, w: box.width, h: box.height };
}

export function AntsScreen({ state, start, won, hint, onMove, onWinShown }: AntsScreenProps) {
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Состояние, которое сейчас показывает рендер (отличие от state = что-то произошло). */
  const shownRef = useRef(state);
  /** Колонки, которые тапнули: следующий новый state — наши ходы, их анимируем по очереди. */
  const pendingRef = useRef<AntsMove[]>([]);
  /** Состояние после наших ходов, пока оболочка их ещё не отрисовала (быстрые тапы в одном такте). */
  const predictedRef = useRef(state);
  const startRef = useRef(start);

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
    const cells = startRef.current.width;
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
    const renderer = new AntsRenderer(canvasRef.current!, shownRef.current, {
      onLeave: (slot, tag) => setSlotsView(view => antLeft(view, slot, tag)),
      onHome: (slot, tag) => setSlotsView(view => antHome(view, slot, tag)),
    });
    rendererRef.current = renderer;
    measure();
    // Раскладка может сдвинуться без изменения размера экрана: на iPhone-PWA
    // env(safe-area-inset-bottom) приходит ПОСЛЕ первой раскладки, нижний ряд растёт,
    // а муравейник и слоты едут вверх. Поэтому следим за каждым рядом, а не только за корнем.
    const observer = new ResizeObserver(measure);
    observer.observe(rootRef.current!);
    for (const row of rootRef.current!.children) {
      observer.observe(row);
    }
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
    const before = predictedRef.current;
    if (won) {
      return;
    }
    // координаты для муравьёв — свежие из DOM перед каждым ходом (одно место правды)
    measure();
    const result = tap(before, column);
    if (!result) {
      if ((before.columns[column]?.length ?? 0) > 0) {
        shake(column);
      }
      return;
    }
    fly(column, result.slot, before.columns[column]![0]!);
    pendingRef.current.push(column);
    predictedRef.current = result.state;
    onMove(column);
  };

  // Новый state: наши ходы — анимируем по очереди (события тот же tap даст детерминированно),
  // иначе (Undo, «заново») — мгновенно показываем как есть.
  useLayoutEffect(() => {
    const previous = shownRef.current;
    if (state === previous) {
      return;
    }
    shownRef.current = state;
    predictedRef.current = state;
    const moves = pendingRef.current;
    pendingRef.current = [];
    let current = previous;
    for (const move of moves) {
      const result = tap(current, move);
      if (!result) {
        break;
      }
      const block = current.columns[move]![0]!;
      const tag = ++placements.current;
      slotTags.current[result.slot] = tag;
      setSlotsView(view => placeBlock(view, result.slot, tag, block.color, block.ants));
      // события слота принадлежат блоку, который в нём сейчас стоит
      const events = result.events.map(event => ({ ...event, tag: slotTags.current[event.slot] ?? 0 }));
      rendererRef.current?.play(result.state, events, FLIGHT_MS);
      current = result.state;
    }
    if (moves.length > 0 && current !== previous) {
      return;
    }
    // у блоков в слотах — новые метки: хвост муравьёв прошлого больше ничего не меняет
    slotTags.current = state.slots.map(slot => (slot ? ++placements.current : 0));
    setSlotsView(viewFromSlots(state.slots, slotTags.current));
    rendererRef.current?.reset(state);
  }, [state]);

  // Подсказка: рука показывает на верхний блок колонки из hint (кончик пальца — в центр блока).
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const block = hint === null ? null : columnRefs.current[hint]?.querySelector('.ants-block');
    if (!root || !block) {
      setHand(null);
      return;
    }
    const rect = relativeRect(block, root);
    setHand({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
  }, [hint, state]);

  // Победа: ждём, пока муравьи добегут, показываем картинку целиком — дальше награда оболочки.
  useEffect(() => {
    if (!won) {
      return;
    }
    rendererRef.current?.whenIdle(() => {
      rendererRef.current?.showWin(startRef.current.pixels);
      onWinShown();
    });
  }, [won, onWinShown]);

  // для скриншотов и ручной проверки в dev: window.__ants
  useEffect(() => {
    if (import.meta.env.DEV) {
      Object.assign(window, {
        __ants: { state: () => stateRef.current, tap: onColumn, layout: () => rendererRef.current?.currentLayout },
      });
    }
  });

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
      {/* зона кнопок оболочки: здесь пусто, 4-й ряд стопок и ниже растворяются в «тумане» */}
      <div className="ants-buttons">
        <div className="ants-fog" aria-hidden="true" />
      </div>
      <canvas className="ants-canvas" ref={canvasRef} />
      {hand ? <HintHand x={hand.x} y={hand.y} /> : null}
    </div>
  );
}

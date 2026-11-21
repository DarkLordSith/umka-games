// Карта уровней игры: тропинка-змейка снизу вверх (уровень 1 внизу), кружки с номерами.
// Цифры можно (ребёнок учит числа), слов нет.
//
// Длинная карта (сотни уровней) рендерится по видимой части: высота содержимого считается
// формулой (номер точки → y), а в DOM только точки в окне прокрутки ± запас и кусок тропинки
// между ними. Прокрутка нативная (плавная, с инерцией iOS), без своих жестов.
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../audio/useAudio';
import { gameProgress, levelsWon, type Progress } from '../engine/progress';
import type { LevelSpec } from '../engine/types';
import type { AnyGame } from '../games/registry';
import { AlbumIcon, HomeIcon, SmallLockIcon } from '../ui/icons';
import type { LevelPlay } from './GameHost';
import './level-map.css';

/** Шаг тропинки по вертикали между точками, px. */
export const MAP_STEP = 116;
/** Закрытых точек впереди видно столько, дальше — «туман». */
export const MAP_LOCKED_AHEAD = 5;
/** Снизу под уровнем 1 — место под домик. */
const PAD_BOTTOM = 150;
/** Сверху над последней закрытой точкой — тропинка уходит в туман. */
const FOG = 240;
/** Запас рендера за краями окна, px. */
const OVERSCAN = 2 * MAP_STEP;
/** Прыжок фишки на следующую точку после победы. */
const JUMP_DELAY_MS = 450;
const JUMP_MS = 750;

type PointKind = 'done' | 'current' | 'locked';

/** Размер кружка точки, px (≥ 64 pt). */
const SIZE: Record<PointKind, number> = { done: 68, current: 88, locked: 64 };

export interface LevelMapProps {
  readonly game: AnyGame;
  readonly progress: Progress;
  /** Только что пройден уровень с этим номером: фишка прыгает с него на следующую точку. */
  readonly jumpFrom: number | null;
  readonly onOpen: (play: LevelPlay) => void;
  readonly onHome: () => void;
  readonly onAlbum: () => void;
}

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly total: number;
  readonly content: number;
}

/** Центр точки с номером n (с 1) в координатах содержимого. */
function pointAt(geometry: Geometry, n: number): { x: number; y: number } {
  const amplitude = Math.min(100, geometry.width * 0.26);
  return {
    x: geometry.width / 2 + amplitude * Math.sin((n - 1) * 0.9),
    y: geometry.content - PAD_BOTTOM - (n - 1) * MAP_STEP,
  };
}

/** Гладкая тропинка через точки (Catmull-Rom → кубические кривые Безье). */
function trailPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) {
    return '';
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function LevelMap({ game, progress, jumpFrom, onOpen, onHome, onAlbum }: LevelMapProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, width: 0, height: 0 });
  const { sfx } = useAudio();

  const saved = gameProgress(progress, game.id, game.startDifficulty);
  const won = levelsWon(saved);
  const current = won + 1;
  const total = current + MAP_LOCKED_AHEAD;
  const geometry: Geometry = {
    width: view.width,
    height: view.height,
    total,
    content: PAD_BOTTOM + (total - 1) * MAP_STEP + FOG,
  };

  /** Параметры следующего уровня: вариант (картинку) выбирает игра «мешком без повторов». */
  const nextSpec = useMemo<LevelSpec>(
    () => ({
      difficulty: saved.difficulty,
      seed: saved.seed,
      variant: game.nextVariant?.(saved.difficulty, saved.seed, saved.levels.map(level => level.variant)) ?? null,
    }),
    [game, saved],
  );

  // размер окна; первая прокрутка — к текущей точке (или к той, с которой прыгнет фишка)
  useLayoutEffect(() => {
    const scroller = scrollerRef.current!;
    const measure = () =>
      setView(old =>
        old.width === scroller.clientWidth && old.height === scroller.clientHeight
          ? old
          : { top: scroller.scrollTop, width: scroller.clientWidth, height: scroller.clientHeight },
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const scrolled = useRef(false);
  useLayoutEffect(() => {
    if (scrolled.current || view.height === 0) {
      return;
    }
    scrolled.current = true;
    const scroller = scrollerRef.current!;
    // фокус — между точкой прыжка и текущей, чуть ниже середины экрана
    const focus = jumpFrom ? (pointAt(geometry, jumpFrom).y + pointAt(geometry, current).y) / 2 : pointAt(geometry, current).y;
    scroller.scrollTop = Math.max(0, focus - view.height * 0.55);
    setView(old => ({ ...old, top: scroller.scrollTop }));
  });

  // прокрутка: обновляем окно рендера не чаще кадра
  useEffect(() => {
    const scroller = scrollerRef.current!;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setView(old => ({ ...old, top: scroller.scrollTop })));
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // прыжок фишки: стоит на текущей точке, анимация стартует с точки только что пройденного уровня
  const jumped = useRef(false);
  useEffect(() => {
    const token = tokenRef.current;
    if (!jumpFrom || jumped.current || !token || view.width === 0) {
      return;
    }
    jumped.current = true;
    const from = pointAt(geometry, jumpFrom);
    const to = pointAt(geometry, current);
    const dx = from.x - to.x;
    const dy = from.y + SIZE.done / 2 - (to.y + SIZE.current / 2);
    const animation = token.animate(
      [
        { translate: `${dx}px ${dy}px`, scale: '1' },
        { translate: `${dx * 0.5}px ${dy * 0.5 - 90}px`, scale: '1.15', offset: 0.5 },
        { translate: '0 0', scale: '1', offset: 0.85 },
        { translate: '0 0', scale: '1.1 0.85', offset: 0.92 },
        { translate: '0 0', scale: '1' },
      ],
      { duration: JUMP_MS, delay: JUMP_DELAY_MS, easing: 'ease-in-out', fill: 'backwards' },
    );
    const hop = window.setTimeout(sfx.hop, JUMP_DELAY_MS);
    animation.oncancel = () => window.clearTimeout(hop);
  });

  // видимые точки: из y окна прокрутки
  const toIndex = (y: number) => (geometry.content - PAD_BOTTOM - y) / MAP_STEP + 1;
  const first = Math.max(1, Math.floor(toIndex(view.top + view.height + OVERSCAN)));
  const last = Math.min(total, Math.ceil(toIndex(view.top - OVERSCAN)));
  const numbers = view.width > 0 && last >= first ? Array.from({ length: last - first + 1 }, (_, i) => first + i) : [];

  // тропинка: от точки ниже окна до точки выше окна; над последней — уходит в туман
  const trail = useMemo(() => {
    if (numbers.length === 0) {
      return '';
    }
    const from = Math.max(1, first - 1);
    const to = Math.min(total + 2, last + 1);
    return trailPath(Array.from({ length: to - from + 1 }, (_, i) => pointAt(geometry, from + i)));
    // geometry выводится из этих чисел
  }, [first, last, total, view.width, geometry.content]);

  const open = (n: number) => {
    sfx.tap();
    if (n <= won) {
      onOpen({ spec: saved.levels[n - 1]!, number: n, replay: true });
    } else if (n === current) {
      onOpen({ spec: nextSpec, number: n, replay: false });
    }
  };

  const shake = (element: HTMLElement) =>
    element.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '-3px' }, { translate: '0' }], {
      duration: 320,
    });

  const Thumbnail = game.Thumbnail;
  const tokenAt = pointAt(geometry, current);

  return (
    <div className="level-map">
      <div className="sky" aria-hidden="true" />
      <div ref={scrollerRef} className="map-scroller">
        <div className="map-content" style={{ height: geometry.content }}>
          <svg className="map-trail" width={view.width} height={geometry.content} aria-hidden="true">
            <path d={trail} className="map-trail-bed" />
            <path d={trail} className="map-trail-dash" />
          </svg>
          {numbers.map(n => {
            const kind: PointKind = n <= won ? 'done' : n === current ? 'current' : 'locked';
            const { x, y } = pointAt(geometry, n);
            const size = SIZE[kind];
            // превью — с той стороны, где больше места (змейка качается от центра)
            const side = x > view.width / 2 ? -1 : 1;
            return (
              <div key={n}>
                {kind === 'done' && Thumbnail ? (
                  <div
                    className="map-thumb"
                    style={{ left: x + side * (size / 2 + 40) - 30, top: y - 30 } as CSSProperties}
                    aria-hidden="true"
                  >
                    <Thumbnail level={saved.levels[n - 1]!} />
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`map-point is-${kind}`}
                  style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
                  aria-label={String(n)}
                  onClick={event => (kind === 'locked' ? shake(event.currentTarget) : open(n))}
                >
                  {kind === 'locked' ? (
                    <span className="map-lock">
                      <SmallLockIcon />
                    </span>
                  ) : (
                    <span className="map-number">{n}</span>
                  )}
                </button>
              </div>
            );
          })}
          {view.width > 0 ? (
            <div
              ref={tokenRef}
              className="map-token"
              style={{ left: tokenAt.x - 28, top: tokenAt.y - SIZE.current / 2 - 60 }}
              aria-hidden="true"
            >
              <game.Icon />
            </div>
          ) : null}
          <div className="map-fog" style={{ height: FOG + MAP_STEP }} aria-hidden="true" />
        </div>
      </div>
      <button type="button" className="map-home" aria-label="в меню" onClick={onHome}>
        <HomeIcon />
      </button>
      <button type="button" className="map-album" aria-label="альбом" onClick={onAlbum}>
        <AlbumIcon />
      </button>
    </div>
  );
}

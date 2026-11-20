import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { setAudioSettings } from '../audio/engine';
import type { Progress } from '../engine/progress';
import { findGame } from '../games/registry';
import { GameHost, type LevelPlay } from './GameHost';
import { LevelMap } from './LevelMap';
import { Menu } from './Menu';
import { ParentScreen } from './ParentScreen';
import { loadProgress, saveProgress } from './storage';

/** Превью для отбраковки (только dev): ?dev=ants — муравьи, ?dev=pictures — картинки. В production-сборку не попадают. */
const AntsPreview = import.meta.env.DEV
  ? lazy(() => import('../games/ants/AntsPreview').then(module => ({ default: module.AntsPreview })))
  : null;
const PicturesPreview = import.meta.env.DEV
  ? lazy(() => import('../games/ants/PicturesPreview').then(module => ({ default: module.PicturesPreview })))
  : null;

function devPage(): string | null {
  return import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;
}

/** В dev можно открыть любой уровень: ?level=12 → сложность 12, seed 12 (для скриншотов и проверки кривой). */
function devLevel(): number | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  const value = Number(new URLSearchParams(window.location.search).get('level'));
  return Number.isInteger(value) && value >= 1 ? value : null;
}

type View =
  | { readonly kind: 'menu' }
  | { readonly kind: 'map'; readonly id: string; readonly jumpFrom: number | null }
  | { readonly kind: 'game'; readonly id: string; readonly play: LevelPlay }
  | { readonly kind: 'parent' };

/** dev ?level=N: сразу уровень муравьёв (сложность N, seed N) как переигровка — прогресс не меняется. */
function devView(): View {
  const level = devLevel();
  return level
    ? { kind: 'game', id: 'ants', play: { spec: { difficulty: level, seed: level, variant: null }, number: level, replay: true } }
    : { kind: 'menu' };
}

/**
 * Оболочка: решает, какой экран показан. Поток: меню → карта игры → уровень → «Дальше» →
 * карта (фишка прыгает на следующую точку) → …; домик в уровне — на карту, домик на карте — в меню.
 * Только она трогает хранилище: победа сохраняется сразу, ещё до награды,
 * чтобы закрытое на конфетти приложение открылось уже с пройденным уровнем.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [view, setView] = useState<View>(devView);
  const onProgress = useCallback((next: Progress) => {
    saveProgress(next);
    setProgress(next);
  }, []);
  const toMenu = useCallback(() => setView({ kind: 'menu' }), []);
  // выключатели звука и голоса из родительского экрана
  useEffect(() => setAudioSettings(progress.settings), [progress.settings]);

  if (AntsPreview && devPage() === 'ants') {
    return (
      <Suspense fallback={null}>
        <AntsPreview />
      </Suspense>
    );
  }

  if (PicturesPreview && devPage() === 'pictures') {
    return (
      <Suspense fallback={null}>
        <PicturesPreview />
      </Suspense>
    );
  }

  if (view.kind === 'parent') {
    return <ParentScreen progress={progress} onProgress={onProgress} onBack={toMenu} />;
  }

  const game = view.kind === 'game' || view.kind === 'map' ? findGame(view.id) : undefined;
  if (game && view.kind === 'game') {
    const { play } = view;
    const toMap = (jumped: boolean) => setView({ kind: 'map', id: game.id, jumpFrom: jumped ? play.number : null });
    return (
      <GameHost
        key={`${game.id}:${play.number}:${play.replay}`}
        game={game}
        play={play}
        progress={progress}
        onProgress={onProgress}
        onExit={() => toMap(false)}
        // после новой победы фишка прыгает; после переигровки — нет
        onDone={() => toMap(!play.replay)}
      />
    );
  }
  if (game && view.kind === 'map') {
    return (
      <LevelMap
        key={game.id}
        game={game}
        progress={progress}
        jumpFrom={view.jumpFrom}
        onOpen={play => setView({ kind: 'game', id: game.id, play })}
        onHome={toMenu}
      />
    );
  }

  return <Menu onPlay={id => setView({ kind: 'map', id, jumpFrom: null })} onParent={() => setView({ kind: 'parent' })} />;
}

import { lazy, Suspense, useCallback, useState } from 'react';
import type { Progress } from '../engine/progress';
import { findGame } from '../games/registry';
import { GameHost } from './GameHost';
import { Menu } from './Menu';
import { ParentScreen } from './ParentScreen';
import { loadProgress, saveProgress } from './storage';

/** Превью для отбраковки (только dev): ?dev=ants. В production-сборку не попадает. */
const AntsPreview = import.meta.env.DEV
  ? lazy(() => import('../games/ants/AntsPreview').then(module => ({ default: module.AntsPreview })))
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

type View = { readonly kind: 'menu' } | { readonly kind: 'game'; readonly id: string } | { readonly kind: 'parent' };

/**
 * Оболочка: решает, какой экран показан (меню → игра → меню, родительский экран).
 * Только она трогает хранилище: победа сохраняется сразу, ещё до награды,
 * чтобы закрытое на конфетти приложение открылось уже на следующем уровне.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // в dev ?level=N сразу открывает муравьёв на этом уровне
  const [view, setView] = useState<View>(() => (devLevel() ? { kind: 'game', id: 'ants' } : { kind: 'menu' }));
  const onProgress = useCallback((next: Progress) => {
    saveProgress(next);
    setProgress(next);
  }, []);
  const toMenu = useCallback(() => setView({ kind: 'menu' }), []);

  if (AntsPreview && devPage() === 'ants') {
    return (
      <Suspense fallback={null}>
        <AntsPreview />
      </Suspense>
    );
  }

  if (view.kind === 'parent') {
    return <ParentScreen progress={progress} onProgress={onProgress} onBack={toMenu} />;
  }

  const game = view.kind === 'game' ? findGame(view.id) : undefined;
  if (game) {
    return <GameHost game={game} progress={progress} onProgress={onProgress} onExit={toMenu} devLevel={devLevel()} />;
  }

  return <Menu onPlay={id => setView({ kind: 'game', id })} onParent={() => setView({ kind: 'parent' })} />;
}

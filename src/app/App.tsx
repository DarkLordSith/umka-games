import { lazy, Suspense, useCallback, useState } from 'react';
import type { Progress } from '../engine/progress';
import { GAMES } from '../games/registry';
import { GameHost } from './GameHost';
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

/**
 * Оболочка. Пока одна игра — открываемся сразу в ней (меню — задача 5).
 * Только оболочка трогает хранилище: победа сохраняется сразу, ещё до награды,
 * чтобы закрытое на конфетти приложение открылось уже на следующем уровне.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const onProgress = useCallback((next: Progress) => {
    saveProgress(next);
    setProgress(next);
  }, []);

  if (AntsPreview && devPage() === 'ants') {
    return (
      <Suspense fallback={null}>
        <AntsPreview />
      </Suspense>
    );
  }

  return <GameHost game={GAMES[0]!} progress={progress} onProgress={onProgress} devLevel={devLevel()} />;
}

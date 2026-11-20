import { lazy, Suspense, useState } from 'react';
import { type Progress, withAntsLevel } from '../engine/progress';
import { AntsScreen } from '../games/ants/Screen';
import { loadProgress, saveProgress } from './storage';

/** Превью для отбраковки (только dev): ?dev=ants. В production-сборку не попадает. */
const AntsPreview = import.meta.env.DEV
  ? lazy(() => import('../games/ants/AntsPreview').then(module => ({ default: module.AntsPreview })))
  : null;

function devPage(): string | null {
  return import.meta.env.DEV ? new URLSearchParams(window.location.search).get('dev') : null;
}

/** В dev можно открыть любой уровень: ?level=12 (для скриншотов и проверки кривой). */
function devLevel(): number | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  const value = Number(new URLSearchParams(window.location.search).get('level'));
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Оболочка. Пока одна игра — открываемся сразу в муравьях (меню — задача 5).
 * Только оболочка трогает хранилище: победа сохраняется сразу, ещё до празднования,
 * чтобы закрытое на конфетти приложение открылось уже на следующем уровне.
 */
export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [level, setLevel] = useState(() => devLevel() ?? progress.games.ants.level);

  const onWin = () => {
    const next = withAntsLevel(progress, level + 1);
    saveProgress(next);
    setProgress(next);
  };

  if (AntsPreview && devPage() === 'ants') {
    return (
      <Suspense fallback={null}>
        <AntsPreview />
      </Suspense>
    );
  }

  return <AntsScreen key={level} level={level} onWin={onWin} onNext={() => setLevel(level + 1)} />;
}

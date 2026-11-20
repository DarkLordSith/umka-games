// Оболочка уровня: сессия (ходы, Undo, «заново», подсказки), адаптивная сложность,
// сохранение и награда. Игра даёт только правила и экран (engine/types.ts).
import { useCallback, useMemo, useRef, useState } from 'react';
import { nextDifficulty } from '../engine/difficulty';
import { gameProgress, type Progress, withGame } from '../engine/progress';
import {
  levelResult,
  type Session,
  sessionCanUndo,
  sessionMove,
  sessionRestart,
  sessionStart,
  sessionState,
  sessionUndo,
  startSession,
} from '../engine/session';
import type { AnyGame } from '../games/registry';
import { Confetti } from '../ui/Confetti';
import './game-host.css';

/** Какой уровень играем: по нему игра детерминированно строит State. */
export interface LevelId {
  readonly difficulty: number;
  readonly seed: number;
}

export interface GameHostProps {
  readonly game: AnyGame;
  readonly progress: Progress;
  /** Новый прогресс: оболочка сохраняет сразу. */
  readonly onProgress: (progress: Progress) => void;
  /** Только dev: открыть конкретный уровень (?level=N → сложность N, seed N). */
  readonly devLevel?: number | null;
}

export function GameHost({ game, progress, onProgress, devLevel }: GameHostProps) {
  const [level, setLevel] = useState<LevelId>(() => {
    if (devLevel) {
      return { difficulty: devLevel, seed: devLevel };
    }
    const saved = gameProgress(progress, game.id, game.startDifficulty);
    return { difficulty: saved.difficulty, seed: saved.seed };
  });
  return (
    <LevelPlayer
      key={`${game.id}:${level.difficulty}:${level.seed}`}
      game={game}
      level={level}
      progress={progress}
      onProgress={onProgress}
      onNext={setLevel}
    />
  );
}

interface LevelPlayerProps {
  readonly game: AnyGame;
  readonly level: LevelId;
  readonly progress: Progress;
  readonly onProgress: (progress: Progress) => void;
  readonly onNext: (level: LevelId) => void;
}

function LevelPlayer({ game, level, progress, onProgress, onNext }: LevelPlayerProps) {
  const start = useMemo(() => game.makeLevel(level.difficulty, level.seed), [game, level]);
  const [session, setSession] = useState<Session<unknown>>(() => startSession(start));
  const sessionRef = useRef(session);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const nextLevel = useRef<LevelId | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const update = (next: Session<unknown>) => {
    sessionRef.current = next;
    setSession(next);
  };

  /** Уровень пройден: новая сложность и следующий seed сохраняются сразу, ещё до награды. */
  const finish = (finished: Session<unknown>) => {
    const result = levelResult(finished);
    const saved = gameProgress(progressRef.current, game.id, game.startDifficulty);
    const adapted = nextDifficulty(
      { difficulty: level.difficulty, streak: saved.streak },
      result.clean,
      game.minDifficulty,
    );
    const seed = level.seed + 1;
    onProgress(withGame(progressRef.current, game.id, { ...adapted, won: saved.won + 1, seed }));
    nextLevel.current = { difficulty: adapted.difficulty, seed };
  };

  const onMove = (move: unknown): boolean => {
    const next = sessionMove(game, sessionRef.current, move);
    if (!next) {
      return false;
    }
    update(next);
    if (game.isWon(sessionState(next))) {
      finish(next);
    }
    return true;
  };

  const onWinShown = useCallback(() => setCelebrating(true), []);
  const state = sessionState(session);
  const won = game.isWon(state);
  const Screen = game.Screen;

  return (
    <>
      <Screen
        state={state}
        start={sessionStart(session)}
        won={won}
        stuck={game.isStuck(state)}
        canUndo={sessionCanUndo(session)}
        onMove={onMove}
        onUndo={() => update(sessionUndo(sessionRef.current))}
        onRestart={() => update(sessionRestart(sessionRef.current))}
        onWinShown={onWinShown}
      />
      {celebrating ? (
        <button
          type="button"
          className="win-overlay"
          aria-label="дальше"
          onPointerDown={() => nextLevel.current && onNext(nextLevel.current)}
        >
          <Confetti seed={level.seed} />
        </button>
      ) : null}
    </>
  );
}

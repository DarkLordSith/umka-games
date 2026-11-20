// Общий экран игры: сессия (ходы, Undo, «заново», подсказки), адаптивная сложность,
// сохранение, награда и кнопки оболочки. Игра даёт только правила и экран (engine/types.ts).
//
// Кнопки — внизу, в зоне --chrome-bottom, которую экран игры оставляет пустой:
// домик (выход долгим нажатием 1 с) и «заново» — слева, Undo — справа.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextDifficulty } from '../engine/difficulty';
import { gameProgress, type Progress, withGame } from '../engine/progress';
import {
  levelResult,
  type Session,
  sessionCanRestart,
  sessionCanUndo,
  sessionHint,
  sessionMove,
  sessionRestart,
  sessionStart,
  sessionState,
  sessionUndo,
  startSession,
} from '../engine/session';
import type { AnyGame } from '../games/registry';
import { Confetti } from '../ui/Confetti';
import { HomeIcon, RestartIcon, UndoIcon } from '../ui/icons';
import { LongPress } from '../ui/LongPress';
import './game-host.css';

/** Столько без хода — и рука показывает подсказку. */
export const HINT_DELAY_MS = 15_000;
/** Выход в меню: держать домик столько. */
export const EXIT_HOLD_MS = 1_000;

/** Только dev: ?hint=2000 — подсказка через 2 с (для проверки). */
function hintDelay(): number {
  if (import.meta.env.DEV) {
    const value = Number(new URLSearchParams(window.location.search).get('hint'));
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return HINT_DELAY_MS;
}

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
  /** Выход в меню (домик, долгое нажатие). */
  readonly onExit: () => void;
  /** Только dev: открыть конкретный уровень (?level=N → сложность N, seed N). */
  readonly devLevel?: number | null;
}

export function GameHost({ game, progress, onProgress, onExit, devLevel }: GameHostProps) {
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
      onExit={onExit}
    />
  );
}

interface LevelPlayerProps {
  readonly game: AnyGame;
  readonly level: LevelId;
  readonly progress: Progress;
  readonly onProgress: (progress: Progress) => void;
  readonly onNext: (level: LevelId) => void;
  readonly onExit: () => void;
}

function LevelPlayer({ game, level, progress, onProgress, onNext, onExit }: LevelPlayerProps) {
  const start = useMemo(() => game.makeLevel(level.difficulty, level.seed), [game, level]);
  const [session, setSession] = useState<Session<unknown>>(() => startSession(start));
  const sessionRef = useRef(session);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const nextLevel = useRef<LevelId | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [hint, setHint] = useState<unknown>(null);

  const update = (next: Session<unknown>) => {
    sessionRef.current = next;
    setSession(next);
  };

  const state = sessionState(session);
  const won = game.isWon(state);
  const stuck = game.isStuck(state);

  // Подсказка: HINT_DELAY_MS без изменений состояния → ход решателя, рука показывает.
  // Любой ход, Undo или «заново» — рука исчезает, отсчёт заново. В тупике руки нет — пульсирует Undo.
  // Засчитывается подсказка (уровень «трудный») только если следующий ход — подсказанный:
  // ребёнок мог просто отвлечься.
  useEffect(() => {
    setHint(null);
    if (won || stuck) {
      return;
    }
    const timer = window.setTimeout(() => {
      const move = game.hint(sessionState(sessionRef.current));
      if (move !== null) {
        update(sessionHint(sessionRef.current, move));
        setHint(move);
      }
    }, hintDelay());
    return () => window.clearTimeout(timer);
  }, [state, won, stuck, game]);

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
  const canUndo = sessionCanUndo(session) && !won;
  const canRestart = sessionCanRestart(session) && !won;
  const Screen = game.Screen;

  return (
    <div className="game-host">
      <Screen state={state} start={sessionStart(session)} won={won} hint={hint} onMove={onMove} onWinShown={onWinShown} />
      <div className="game-chrome">
        <LongPress className="chrome-home" duration={EXIT_HOLD_MS} onComplete={onExit} label="в меню">
          <HomeIcon />
        </LongPress>
        <button
          type="button"
          className="chrome-restart"
          aria-label="заново"
          disabled={!canRestart}
          onPointerDown={() => update(sessionRestart(sessionRef.current))}
        >
          <RestartIcon />
        </button>
        <button
          type="button"
          className={stuck && !won ? 'chrome-undo is-pulsing' : 'chrome-undo'}
          aria-label="назад"
          disabled={!canUndo}
          onPointerDown={() => update(sessionUndo(sessionRef.current))}
        >
          <UndoIcon />
        </button>
      </div>
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
    </div>
  );
}

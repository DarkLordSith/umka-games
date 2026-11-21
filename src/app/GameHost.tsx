// Общий экран игры: сессия (ходы, Undo, «заново», подсказки), адаптивная сложность,
// сохранение, награда и кнопки оболочки. Игра даёт только правила и экран (engine/types.ts).
//
// Кнопки — внизу, в зоне --chrome-bottom, которую экран игры оставляет пустой:
// домик (на карту долгим нажатием 1 с) и «заново» — слева, Undo — справа.
// Победа: конфетти, картинка уровня «отклеивается» наклейкой и летит в альбом в углу,
// только потом крупная «Дальше» (▶) — на карту.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../audio/useAudio';
import type { LevelSpec } from '../engine/types';
import { nextDifficulty } from '../engine/difficulty';
import { type StickerReward, stickerReward } from '../engine/collection';
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
import { WinSticker } from '../rewards/WinSticker';
import { AlbumIcon, HomeIcon, NextIcon, RestartIcon, UndoIcon } from '../ui/icons';
import { LongPress } from '../ui/LongPress';
import './game-host.css';

/** Столько без хода — и рука показывает подсказку. */
export const HINT_DELAY_MS = 15_000;
/** Выход на карту: держать домик столько. */
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

/** Какой уровень играем: параметры, номер точки на карте и переигровка ли это. */
export interface LevelPlay {
  readonly spec: LevelSpec;
  /** Номер точки на карте (с 1). */
  readonly number: number;
  /** Переигровка пройденного уровня: победа, подсказки и тупики не меняют прогресс. */
  readonly replay: boolean;
}

export interface GameHostProps {
  readonly game: AnyGame;
  readonly play: LevelPlay;
  readonly progress: Progress;
  /** Новый прогресс: оболочка сохраняет сразу. */
  readonly onProgress: (progress: Progress) => void;
  /** Домик (долгое нажатие) — на карту. */
  readonly onExit: () => void;
  /** Кнопка «Дальше» после победы — на карту. */
  readonly onDone: () => void;
}

export function GameHost({ game, play, progress, onProgress, onExit, onDone }: GameHostProps) {
  const start = useMemo(() => game.makeLevel(play.spec), [game, play]);
  const [session, setSession] = useState<Session<unknown>>(() => startSession(start));
  const sessionRef = useRef(session);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [celebrating, setCelebrating] = useState(false);
  /** Наклейка за этот уровень (считается в момент победы, до сохранения). null — у игры альбома нет. */
  const rewardRef = useRef<StickerReward | null>(null);
  /** Наклейка долетела до альбома — можно показать «Дальше». */
  const [rewarded, setRewarded] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const albumRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<unknown>(null);

  const update = (next: Session<unknown>) => {
    sessionRef.current = next;
    setSession(next);
  };

  const state = sessionState(session);
  const won = game.isWon(state);
  const stuck = game.isStuck(state);
  const audio = useAudio();

  // тупик: голос «Давай попробуем назад» — один раз за уровень (дальше хватает пульса Undo)
  const stuckSaid = useRef(false);
  useEffect(() => {
    if (stuck && !won && !stuckSaid.current) {
      stuckSaid.current = true;
      audio.say('stuck-back');
    }
  }, [stuck, won, audio]);

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
        audio.sayFrom('hint');
      }
    }, hintDelay());
    return () => window.clearTimeout(timer);
  }, [state, won, stuck, game, audio]);

  /**
   * Уровень пройден: сразу, ещё до награды, сохраняются запись уровня (для карты
   * и переигровки), новая сложность и следующий seed. Наклейка из прогресса выводится сама
   * (engine/collection). Переигровка прогресс не трогает.
   */
  const finish = (finished: Session<unknown>) => {
    const before = gameProgress(progressRef.current, game.id, game.startDifficulty).levels;
    rewardRef.current = game.album ? stickerReward(game.album, before, play.spec) : null;
    if (play.replay) {
      return;
    }
    const result = levelResult(finished);
    const saved = gameProgress(progressRef.current, game.id, game.startDifficulty);
    const adapted = nextDifficulty({ difficulty: play.spec.difficulty, streak: saved.streak }, result.clean, game.minDifficulty);
    onProgress(
      withGame(progressRef.current, game.id, {
        ...adapted,
        seed: play.spec.seed + 1,
        levels: [...saved.levels, play.spec],
      }),
    );
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

  // победа: арпеджио и конфетти; голос — у наклейки («Новая наклейка!» или похвала на повторе).
  // Нет наклейки у игры — сразу похвала и «Дальше».
  const onWinShown = useCallback(() => {
    setCelebrating(true);
    audio.sfx.win();
    if (!rewardRef.current) {
      audio.sayFrom('praise');
      setRewarded(true);
    }
  }, [audio]);
  const reward = rewardRef.current;
  const canUndo = sessionCanUndo(session) && !won;
  const canRestart = sessionCanRestart(session) && !won;
  const Screen = game.Screen;

  return (
    <div ref={hostRef} className="game-host">
      <Screen state={state} start={sessionStart(session)} won={won} hint={hint} onMove={onMove} onWinShown={onWinShown} />
      <div className="game-chrome">
        <LongPress className="chrome-home" duration={EXIT_HOLD_MS} onComplete={onExit} label="на карту">
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
        // тап мимо «Дальше» ничего не делает: ребёнок любуется картинкой
        <div className="win-overlay">
          <Confetti seed={play.spec.seed} />
          {reward && game.album ? (
            <>
              <div ref={albumRef} className="win-album" aria-hidden="true">
                <AlbumIcon />
              </div>
              <WinSticker album={game.album} reward={reward} stage={hostRef} target={albumRef} onDone={() => setRewarded(true)} />
            </>
          ) : null}
          {rewarded ? (
            <button type="button" className="win-next" aria-label="дальше" onClick={onDone}>
              <NextIcon />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

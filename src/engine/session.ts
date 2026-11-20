// Сессия уровня: история снимков (Undo без ограничений), счёт ходов и подсказок,
// был ли тупик. Чистые функции; оболочка хранит сессию и передаёт экрану состояние.
import { canUndo, createHistory, current, type History, push, restart, undo } from './history';
import type { GameRules } from './types';

export interface Session<State> {
  readonly history: History<State>;
  /** Сделанных ходов за уровень (Undo их не уменьшает). */
  readonly moves: number;
  /** Сколько раз показали подсказку. */
  readonly hints: number;
  /** Хоть раз попадали в тупик. */
  readonly stuckSeen: boolean;
}

export function startSession<State>(state: State): Session<State> {
  return { history: createHistory(state), moves: 0, hints: 0, stuckSeen: false };
}

export function sessionState<State>(session: Session<State>): State {
  return current(session.history);
}

export function sessionStart<State>(session: Session<State>): State {
  return session.history.snapshots[0]!;
}

/** Ход. null — невозможен или уровень уже пройден. */
export function sessionMove<State, Move>(
  rules: GameRules<State, Move>,
  session: Session<State>,
  move: Move,
): Session<State> | null {
  const state = sessionState(session);
  if (rules.isWon(state)) {
    return null;
  }
  const next = rules.applyMove(state, move);
  if (next === null) {
    return null;
  }
  return {
    history: push(session.history, next),
    moves: session.moves + 1,
    hints: session.hints,
    stuckSeen: session.stuckSeen || rules.isStuck(next),
  };
}

export function sessionCanUndo<State>(session: Session<State>): boolean {
  return canUndo(session.history);
}

/** Шаг назад; счётчики и «был тупик» остаются — уровень всё равно не «чистый». */
export function sessionUndo<State>(session: Session<State>): Session<State> {
  return { ...session, history: undo(session.history) };
}

/** «Заново»: к стартовому снимку, счётчики остаются. */
export function sessionRestart<State>(session: Session<State>): Session<State> {
  return { ...session, history: restart(session.history) };
}

/** Показали подсказку. */
export function sessionHint<State>(session: Session<State>): Session<State> {
  return { ...session, hints: session.hints + 1 };
}

export interface LevelResult {
  readonly moves: number;
  readonly hints: number;
  readonly stuck: boolean;
  /** Пройден без подсказки и без тупика — шаг к повышению сложности. */
  readonly clean: boolean;
}

export function levelResult<State>(session: Session<State>): LevelResult {
  return {
    moves: session.moves,
    hints: session.hints,
    stuck: session.stuckSeen,
    clean: session.hints === 0 && !session.stuckSeen,
  };
}

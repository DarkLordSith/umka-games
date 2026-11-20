// Сессия уровня: история снимков (Undo без ограничений), счёт ходов и подсказок,
// был ли тупик. Чистые функции; оболочка хранит сессию и передаёт экрану состояние.
import { atStart, canUndo, createHistory, current, type History, push, restart, undo } from './history';
import type { GameRules } from './types';

export interface Session<State> {
  readonly history: History<State>;
  /** Сделанных ходов за уровень (Undo их не уменьшает). */
  readonly moves: number;
  /** Сколько подсказок засчитано: ребёнок сделал ровно подсказанный ход. */
  readonly hints: number;
  /** Показанная подсказка, ещё без ответа: засчитается, если следующий ход совпадёт с ней. */
  readonly shownHint: unknown;
  /** Хоть раз попадали в тупик. */
  readonly stuckSeen: boolean;
}

export function startSession<State>(state: State): Session<State> {
  return { history: createHistory(state), moves: 0, hints: 0, shownHint: null, stuckSeen: false };
}

export function sessionState<State>(session: Session<State>): State {
  return current(session.history);
}

export function sessionStart<State>(session: Session<State>): State {
  return session.history.snapshots[0]!;
}

/** Ходы — простые данные (как и снимки), поэтому сравниваем по значению. */
function sameMove(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
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
    // подсказка «трудная», только если ею воспользовались: следующий ход — подсказанный
    hints: session.shownHint !== null && sameMove(session.shownHint, move) ? session.hints + 1 : session.hints,
    shownHint: null,
    stuckSeen: session.stuckSeen || rules.isStuck(next),
  };
}

export function sessionCanUndo<State>(session: Session<State>): boolean {
  return canUndo(session.history);
}

export function sessionCanRestart<State>(session: Session<State>): boolean {
  return !atStart(session.history);
}

/** Шаг назад; счётчики и «был тупик» остаются. Подсказка снимается — она была для другого состояния. */
export function sessionUndo<State>(session: Session<State>): Session<State> {
  return { ...session, history: undo(session.history), shownHint: null };
}

/** «Заново»: стартовый снимок поверх истории (Undo вернёт назад); ходы и «был тупик» остаются. */
export function sessionRestart<State>(session: Session<State>): Session<State> {
  return { ...session, history: restart(session.history), shownHint: null };
}

/** Показали подсказку `move`. Сама по себе она уровень не портит — см. sessionMove. */
export function sessionHint<State>(session: Session<State>, move: unknown): Session<State> {
  return { ...session, shownHint: move };
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

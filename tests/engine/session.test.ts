import { describe, expect, it } from 'vitest';
import {
  levelResult,
  sessionCanRestart,
  sessionCanUndo,
  sessionHint,
  sessionMove,
  sessionRestart,
  sessionStart,
  sessionState,
  sessionUndo,
  startSession,
} from '../../src/engine/session';
import type { GameRules } from '../../src/engine/types';

// Игрушечная игра: число, ход прибавляет; 10 — победа, ровно 7 — тупик, отрицательные ходы запрещены.
const rules: GameRules<number, number> = {
  applyMove: (state, move) => (move < 0 ? null : state + move),
  isWon: state => state >= 10,
  isStuck: state => state === 7,
};

describe('сессия уровня', () => {
  it('ход, счёт ходов, Undo до начала, «заново»', () => {
    let session = startSession(0);
    session = sessionMove(rules, session, 3)!;
    session = sessionMove(rules, session, 2)!;
    expect(sessionState(session)).toBe(5);
    expect(session.moves).toBe(2);
    session = sessionUndo(sessionUndo(session));
    expect(sessionState(session)).toBe(0);
    expect(sessionCanUndo(session)).toBe(false);
    expect(session.moves).toBe(2); // Undo не отменяет счёт
    session = sessionRestart(sessionMove(rules, session, 4)!);
    expect(sessionState(session)).toBe(0);
    expect(sessionStart(session)).toBe(0);
  });

  it('«заново» отменяется: ход → ход → «заново» → Undo = после двух ходов', () => {
    let session = sessionMove(rules, sessionMove(rules, startSession(0), 3)!, 4)!;
    session = sessionRestart(session);
    expect(sessionState(session)).toBe(0);
    expect(session.moves).toBe(2); // ходы не обнуляются
    expect(sessionCanRestart(session)).toBe(false); // уже на старте
    expect(sessionCanUndo(session)).toBe(true);
    session = sessionUndo(session);
    expect(sessionState(session)).toBe(7);
    expect(session.stuckSeen).toBe(true); // «был тупик» не стирается
  });

  it('невозможный ход и ход после победы — null', () => {
    const session = startSession(0);
    expect(sessionMove(rules, session, -1)).toBeNull();
    const won = sessionMove(rules, session, 10)!;
    expect(rules.isWon(sessionState(won))).toBe(true);
    expect(sessionMove(rules, won, 1)).toBeNull();
  });

  it('чистый уровень — без подсказки и тупика', () => {
    const clean = sessionMove(rules, startSession(0), 10)!;
    expect(levelResult(clean)).toEqual({ moves: 1, hints: 0, stuck: false, clean: true });
  });

  it('тупик запоминается даже после Undo; подсказка тоже делает уровень «трудным»', () => {
    let session = sessionMove(rules, startSession(0), 7)!;
    expect(session.stuckSeen).toBe(true);
    session = sessionMove(rules, sessionUndo(session), 10)!;
    expect(levelResult(session).clean).toBe(false);
  });

  it('подсказка засчитана, если следующий ход — подсказанный', () => {
    const hinted = sessionMove(rules, sessionHint(startSession(0), 10), 10)!;
    expect(levelResult(hinted)).toMatchObject({ hints: 1, clean: false });
  });

  it('проигнорированная подсказка не засчитывается', () => {
    // отвлёкся, потом сам сходил иначе
    let session = sessionMove(rules, sessionHint(startSession(0), 5), 3)!;
    expect(session.hints).toBe(0);
    // подсказка уже снята: совпадение позже не считается
    session = sessionMove(rules, sessionMove(rules, session, 5)!, 2)!;
    expect(levelResult(session)).toMatchObject({ hints: 0, clean: true });
  });

  it('Undo и «заново» снимают подсказку', () => {
    const shown = sessionHint(sessionMove(rules, startSession(0), 1)!, 9);
    expect(sessionMove(rules, sessionUndo(shown), 9)!.hints).toBe(0);
    expect(sessionMove(rules, sessionRestart(shown), 9)!.hints).toBe(0);
  });

  it('ходы-объекты сравниваются по значению', () => {
    const objectRules: GameRules<number, { add: number }> = {
      applyMove: (state, move) => state + move.add,
      isWon: state => state >= 10,
      isStuck: () => false,
    };
    const session = sessionMove(objectRules, sessionHint(startSession(0), { add: 2 }), { add: 2 })!;
    expect(session.hints).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { applyMove, type AntsState, isStuck, isWon } from '../../src/games/ants/logic';
import { canGetStuck, hint, solve } from '../../src/games/ants/solver';
import { B, block, makeState, R } from './helpers';

const BOX = ['RRRRR', 'RBBBR', 'RBBBR', 'RBBBR', 'RRRRR'];
// Пять синих блоков сверху: тапнешь их первыми — тупик. Решение — сначала красный.
const TRAP = (): AntsState =>
  makeState(BOX, [[block(B, 1), block(B, 1), block(B, 1), block(B, 1), block(B, 1), block(B, 4)], [block(R, 16)]]);

function play(state: AntsState, moves: readonly number[]): AntsState {
  return moves.reduce((current, move) => applyMove(current, move)!, state);
}

describe('решатель', () => {
  it('находит последовательность, которая ведёт к победе', () => {
    const moves = solve(TRAP())!;
    expect(moves).not.toBeNull();
    expect(isWon(play(TRAP(), moves))).toBe(true);
  });

  it('hint — первый ход решения, обходит ловушку', () => {
    expect(hint(TRAP())).toBe(1);
  });

  it('из тупика решения нет', () => {
    const stuck = play(TRAP(), [0, 0, 0, 0, 0]);
    expect(isStuck(stuck)).toBe(true);
    expect(solve(stuck)).toBeNull();
    expect(hint(stuck)).toBeNull();
  });

  it('уже победа — пустое решение', () => {
    expect(solve(makeState(['..'], []))).toEqual([]);
  });

  it('canGetStuck: ловушка — да, картинка без внутренних цветов — нет', () => {
    expect(canGetStuck(TRAP())).toBe(true);
    const open = makeState(['RRBB', 'RRBB'], [[block(R, 2), block(B, 2)], [block(B, 2), block(R, 2)]]);
    expect(canGetStuck(open)).toBe(false);
  });

  it('при превышении лимита canGetStuck осторожничает (true), solve — null', () => {
    expect(canGetStuck(TRAP(), { maxNodes: 1 })).toBe(true);
    expect(solve(TRAP(), { maxNodes: 0 })).toBeNull();
  });
});

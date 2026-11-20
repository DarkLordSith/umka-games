import { describe, expect, it } from 'vitest';
import { canUndo, createHistory, current, push, undo } from '../../src/engine/history';
import { levelParams, makeLevel, onionLayers, outlinePicture, SAFE_LEVELS } from '../../src/games/ants/generator';
import { antsByColor, applyMove, EMPTY, isWon, pixelsByColor, SLOT_COUNT } from '../../src/games/ants/logic';
import { PICTURES } from '../../src/games/ants/pictures';
import { canGetStuck, solve } from '../../src/games/ants/solver';

const LEVELS = Array.from({ length: 50 }, (_, index) => index + 1);
const seedFor = (level: number) => level * 1000 + 7;

describe('генератор', () => {
  it('детерминизм: тот же (level, seed) — тот же уровень', () => {
    for (const level of [1, 7, 23, 50]) {
      expect(makeLevel(level, 42)).toEqual(makeLevel(level, 42));
    }
    expect(makeLevel(30, 1)).not.toEqual(makeLevel(30, 2));
  });

  it('уровень стартует с пустыми слотами и непустыми колонками', () => {
    const state = makeLevel(10, 1);
    expect(state.slots).toHaveLength(SLOT_COUNT);
    expect(state.slots.every(slot => slot === null)).toBe(true);
    expect(state.columns.every(column => column.length > 0)).toBe(true);
  });

  it('инвариант: муравьёв цвета = пикселей цвета (уровни 1–50)', () => {
    for (const level of LEVELS) {
      const state = makeLevel(level, seedFor(level));
      expect(antsByColor(state), `уровень ${level}`).toEqual(pixelsByColor(state));
    }
  });

  it('уровни 1–50 решаемы, каждый генерируется и решается быстрее 200 мс', () => {
    const slow: string[] = [];
    for (const level of LEVELS) {
      const started = performance.now();
      const state = makeLevel(level, seedFor(level));
      const moves = solve(state);
      const elapsed = performance.now() - started;
      expect(moves, `уровень ${level}`).not.toBeNull();
      expect(isWon(moves!.reduce((current, move) => applyMove(current, move)!, state))).toBe(true);
      if (elapsed > 200) {
        slow.push(`уровень ${level}: ${elapsed.toFixed(0)} мс`);
      }
    }
    expect(slow).toEqual([]);
  });

  it(`сложность 1–${SAFE_LEVELS} — без возможного тупика на любой картинке`, () => {
    for (let level = 1; level <= SAFE_LEVELS; level++) {
      // seed 1…10 — все картинки по кругу (картинку выбирает seed)
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        expect(canGetStuck(makeLevel(level, seed)), `уровень ${level}, seed ${seed}`).toBe(false);
      }
    }
  });

  it('сложность растёт: колонок не меньше, блоки не крупнее, порядок не легче', () => {
    for (const level of LEVELS.slice(1)) {
      const before = levelParams(level - 1);
      const now = levelParams(level);
      expect(now.columns).toBeGreaterThanOrEqual(before.columns);
      expect(now.maxBlock).toBeLessThanOrEqual(before.maxBlock);
      expect(now.minBlock).toBeLessThanOrEqual(before.minBlock);
      expect(now.order).toBeLessThanOrEqual(before.order);
    }
  });

  it('обводка: внешний слой — новый цвет, внутренние пиксели не тронуты', () => {
    for (const picture of PICTURES) {
      const outlined = outlinePicture(picture);
      const layers = onionLayers(picture);
      const ring = new Set(outlined.pixels.filter((_, index) => layers[index] === 0));
      expect(ring.size, picture.id).toBe(1);
      expect(picture.pixels, picture.id).not.toContain([...ring][0]);
      outlined.pixels.forEach((cell, index) => {
        if (layers[index]! > 0 || cell === EMPTY) {
          expect(cell).toBe(picture.pixels[index]);
        }
      });
    }
  });

  it('Undo до начала: решение проигрывается и откатывается к стартовому уровню', () => {
    const start = makeLevel(12, 5);
    let history = createHistory(start);
    for (const move of solve(start)!) {
      history = push(history, applyMove(current(history), move)!);
    }
    expect(isWon(current(history))).toBe(true);
    while (canUndo(history)) {
      history = undo(history);
    }
    expect(current(history)).toBe(start);
  });
});

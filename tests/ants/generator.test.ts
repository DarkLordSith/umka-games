import { describe, expect, it } from 'vitest';
import { canUndo, createHistory, current, push, undo } from '../../src/engine/history';
import {
  levelParams,
  makeLevel,
  levelFromSpec,
  makeLevelFor,
  nextPicture,
  PICTURE_IDS,
  pictureFor,
  onionLayers,
  outlinePicture,
  pickPicture,
  SAFE_LEVELS,
  sizeClass,
} from '../../src/games/ants/generator';
import { antsByColor, applyMove, EMPTY, isWon, pixelsByColor, SLOT_COUNT } from '../../src/games/ants/logic';
import { PICTURES } from '../../src/games/ants/pictures';
import { canGetStuck, solve } from '../../src/games/ants/solver';
import { LEVEL_BUDGET_MS, stableMs } from './helpers';
import { BLACK } from '../../src/ui/palette';

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

  it(`уровни 1–50 решаемы, каждый генерируется и решается быстрее ${LEVEL_BUDGET_MS} мс`, () => {
    const slow: string[] = [];
    for (const level of LEVELS) {
      let state = makeLevel(1, 1);
      let moves: number[] | null = null;
      const elapsed = stableMs(() => {
        state = makeLevel(level, seedFor(level));
        moves = solve(state);
      });
      expect(moves, `уровень ${level}`).not.toBeNull();
      expect(isWon(moves!.reduce((current, move) => applyMove(current, move)!, state))).toBe(true);
      if (elapsed > LEVEL_BUDGET_MS) {
        slow.push(`уровень ${level}: ${elapsed.toFixed(0)} мс`);
      }
    }
    expect(slow).toEqual([]);
  });

  it(`сложность 1–${SAFE_LEVELS} — без возможного тупика на любой картинке`, () => {
    for (let level = 1; level <= SAFE_LEVELS; level++) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
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

  it('обводка: внешний слой — чёрный, внутренние пиксели не тронуты', () => {
    for (const picture of PICTURES) {
      const outlined = outlinePicture(picture);
      const layers = onionLayers(picture);
      const ring = new Set(outlined.pixels.filter((_, index) => layers[index] === 0));
      expect([...ring], picture.id).toEqual([BLACK]);
      outlined.pixels.forEach((cell, index) => {
        if (layers[index]! > 0 || cell === EMPTY) {
          expect(cell).toBe(picture.pixels[index]);
        }
      });
    }
  });

  it(`каждая картинка решаема на сложностях 1, 10, 30, 50; генерация ≤ ${LEVEL_BUDGET_MS} мс`, () => {
    const failed: string[] = [];
    const slow: string[] = [];
    for (const picture of PICTURES) {
      for (const level of [1, 10, 30, 50]) {
        const seed = level * 13 + 5;
        let state = makeLevelFor(picture, 1, 1);
        const elapsed = stableMs(() => {
          state = makeLevelFor(picture, level, seed);
        });
        if (!solve(state)) {
          failed.push(`${picture.id} на ${level}`);
        }
        if (elapsed > LEVEL_BUDGET_MS) {
          slow.push(`${picture.id} ${picture.width}×${picture.height} на ${level}: ${elapsed.toFixed(0)} мс`);
        }
      }
    }
    expect(failed).toEqual([]);
    expect(slow).toEqual([]);
  });

  it('размер сетки растёт со сложностью, но с разнообразием; подряд одна картинка не идёт', () => {
    const histogram = (level: number) => {
      const counts = [0, 0, 0, 0];
      for (let seed = 1; seed <= 200; seed++) {
        counts[sizeClass(PICTURES[pickPicture(level, seed)]!)]!++;
      }
      return counts;
    };
    const easy = histogram(1);
    const hard = histogram(40);
    expect(easy[0]!).toBe(200); // первые уровни — только 12×12
    const early = histogram(SAFE_LEVELS + 1);
    expect(early[0]!).toBeGreaterThan(early[1]!);
    expect(hard[2]! + hard[3]!).toBeGreaterThan(150);
    expect(hard.filter(count => count > 0).length).toBeGreaterThanOrEqual(3);
    for (const level of [1, 20, 40]) {
      for (let seed = 2; seed <= 200; seed++) {
        expect(pickPicture(level, seed)).not.toBe(pickPicture(level, seed - 1));
      }
    }
  });

  it('мешок картинок: круг без повторов, детерминированно, подряд одна не идёт', () => {
    for (const level of [1, 8, 25, 45]) {
      const played: string[] = [];
      for (let seed = 1; seed <= PICTURE_IDS.length * 2; seed++) {
        const id = nextPicture(level, seed, played);
        expect(nextPicture(level, seed, played)).toBe(id);
        expect(id).not.toBe(played[played.length - 1]);
        played.push(id);
      }
      if (level > SAFE_LEVELS) {
        // первый круг — все картинки по одному разу
        expect(new Set(played.slice(0, PICTURE_IDS.length)).size, `сложность ${level}`).toBe(PICTURE_IDS.length);
      }
    }
  });

  it('первые уровни — только 12×12, даже когда 12×12 круга кончились', () => {
    const played = PICTURES.filter(picture => sizeClass(picture) === 0).map(picture => picture.id);
    for (let seed = 1; seed <= 20; seed++) {
      expect(sizeClass(pictureFor({ difficulty: 1, seed, variant: nextPicture(1, seed, played) }))).toBe(0);
    }
  });

  it('уровень из записи прогресса — с сохранённой картинкой; пропавшая — запасной выбор по seed', () => {
    const state = levelFromSpec({ difficulty: 10, seed: 3, variant: 'cake' });
    const cake = PICTURES.find(picture => picture.id === 'cake')!;
    expect([state.width, state.height]).toEqual([cake.width, cake.height]);
    expect(levelFromSpec({ difficulty: 10, seed: 3, variant: 'cake' })).toEqual(state);
    expect(levelFromSpec({ difficulty: 10, seed: 3, variant: 'нет-такой' })).toEqual(makeLevel(10, 3));
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

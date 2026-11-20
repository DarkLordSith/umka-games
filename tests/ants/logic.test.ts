import { describe, expect, it } from 'vitest';
import {
  accessiblePixels,
  antsByColor,
  applyMove,
  canEat,
  EMPTY,
  isAccessible,
  isStuck,
  isWon,
  legalMoves,
  pixelsByColor,
  SLOT_COUNT,
  tap,
} from '../../src/games/ants/logic';
import { B, block, makeState, R } from './helpers';

// Синяя середина в красной рамке. Муравейник — под картинкой по центру, в точке (2, 3).
const FRAME = ['RRRRR', 'RBBBR', 'RRRRR'];

describe('доступные пиксели', () => {
  it('непустой и сосед пуст или за краем', () => {
    const state = makeState(FRAME, []);
    // вся рамка на краю — доступна; синие окружены — нет
    expect(accessiblePixels(state)).toHaveLength(12);
    expect(isAccessible(state, 2, 1)).toBe(false);
    expect(canEat(state, B)).toBe(false);
    expect(canEat(state, R)).toBe(true);
  });

  it('внутренний пиксель открывается, когда сосед съеден', () => {
    const state = makeState(['RRRRR', 'RBBBR', 'RR.RR'], []);
    expect(isAccessible(state, 2, 1)).toBe(true);
    expect(isAccessible(state, 1, 1)).toBe(false);
  });

  it('замкнутая дырка не открывает соседей: муравьи не ходят сквозь стену', () => {
    // синий — в дырке внутри красного кольца, дырка не связана с внешним краем
    const ring = ['RRRRR', 'R...R', 'R.B.R', 'R...R', 'RRRRR'];
    const state = makeState(ring, []);
    expect(isAccessible(state, 2, 2)).toBe(false);
    expect(canEat(state, B)).toBe(false);
    // внутренняя сторона кольца тоже закрыта: доступна только внешняя рамка
    expect(accessiblePixels(state)).toHaveLength(16);
    // прогрызли кольцо — дырка связана с краем, синий открылся
    const opened = makeState(['RR.RR', 'R...R', 'R.B.R', 'R...R', 'RRRRR'], []);
    expect(isAccessible(opened, 2, 2)).toBe(true);
  });

  it('замкнутая дырка открывается прямо во время хода', () => {
    // синий над замкнутой дыркой; красный съест ближайший к муравейнику пиксель — низ кольца,
    // дырка свяжется с краем, и синий в той же раздаче доберётся до середины через неё
    const state = makeState(['.....', '.RRR.', '.RBR.', '.R.R.', '.RRR.'], [[block(B, 1)], [block(R, 1)]]);
    const waiting = tap(state, 0)!;
    expect(waiting.events).toEqual([]); // по старому правилу (сосед пуст) синий съел бы сразу
    const after = tap(waiting.state, 1)!;
    expect(after.events).toEqual([
      { slot: 1, x: 2, y: 4 },
      { slot: 0, x: 2, y: 2 },
    ]);
  });

  it('пустая клетка недоступна', () => {
    const state = makeState(['R.R'], []);
    expect(isAccessible(state, 1, 0)).toBe(false);
  });
});

describe('ход tap', () => {
  it('верхний блок уходит в первый свободный слот, муравьи едят ближайшие к муравейнику', () => {
    const state = makeState(FRAME, [[block(R, 2), block(B, 3)]]);
    const result = tap(state, 0)!;
    expect(result.slot).toBe(0);
    // (2,2) ближе всех; дальше (1,2) и (3,2) на равном расстоянии — меньший столбец
    expect(result.events).toEqual([
      { slot: 0, x: 2, y: 2 },
      { slot: 0, x: 1, y: 2 },
    ]);
    // блок съел всё — слот свободен, колонка сдвинулась
    expect(result.state.slots.every(slot => slot === null)).toBe(true);
    expect(result.state.columns[0]).toEqual([block(B, 3)]);
  });

  it('нечего есть — блок ждёт в слоте', () => {
    const state = makeState(FRAME, [[block(B, 3)]]);
    const result = tap(state, 0)!;
    expect(result.events).toEqual([]);
    expect(result.state.slots[0]).toEqual({ color: B, left: 3 });
  });

  it('разрешение по кругу: каждый слот ест по 1 пикселю за раунд', () => {
    const waiting = makeState(FRAME, [[block(R, 3)]], [{ color: B, left: 3 }]);
    const result = tap(waiting, 0)!;
    expect(result.slot).toBe(1);
    expect(result.events).toEqual([
      { slot: 1, x: 2, y: 2 }, // раунд 1: синим нечего, красный открывает дыру
      { slot: 0, x: 2, y: 1 }, // раунд 2: синий съел открывшийся
      { slot: 1, x: 1, y: 2 },
      { slot: 0, x: 1, y: 1 }, // раунд 3
      { slot: 1, x: 3, y: 2 }, // красный блок кончился
      { slot: 0, x: 3, y: 1 }, // раунд 4
    ]);
    expect(result.state.slots.every(slot => slot === null)).toBe(true);
  });

  it('пустая колонка или нет свободных слотов — ход невозможен', () => {
    expect(tap(makeState(FRAME, [[]]), 0)).toBeNull();
    expect(tap(makeState(FRAME, [[block(R, 1)]]), 5)).toBeNull();
    const full = Array.from({ length: SLOT_COUNT }, () => ({ color: B, left: 1 }));
    expect(tap(makeState(FRAME, [[block(R, 1)]], full), 0)).toBeNull();
  });

  it('исходное состояние не мутирует', () => {
    const state = makeState(FRAME, [[block(R, 3)]], [{ color: B, left: 3 }]);
    const before = structuredClone(state);
    tap(state, 0);
    expect(state).toEqual(before);
  });

  it('applyMove — то же состояние, что tap', () => {
    const state = makeState(FRAME, [[block(R, 2)]]);
    expect(applyMove(state, 0)).toEqual(tap(state, 0)!.state);
    expect(applyMove(state, 3)).toBeNull();
  });
});

describe('победа и тупик', () => {
  const BOX = ['RRRRR', 'RBBBR', 'RBBBR', 'RBBBR', 'RRRRR'];

  it('isWon — картинка пуста', () => {
    const state = makeState(['RR'], [[block(R, 2)]]);
    expect(isWon(state)).toBe(false);
    const won = applyMove(state, 0)!;
    expect(isWon(won)).toBe(true);
    expect(won.pixels.every(cell => cell === EMPTY)).toBe(true);
  });

  it('isStuck — 5 слотов заняты и никто не может есть', () => {
    let state = makeState(BOX, [[block(B, 1), block(B, 1), block(B, 1), block(B, 1), block(B, 1), block(B, 4)], [block(R, 16)]]);
    for (let i = 0; i < SLOT_COUNT; i++) {
      expect(isStuck(state)).toBe(false);
      state = applyMove(state, 0)!;
    }
    expect(isStuck(state)).toBe(true);
    expect(legalMoves(state)).toEqual([]);
    expect(applyMove(state, 1)).toBeNull();
  });

  it('занятые слоты, но кто-то может есть — не тупик', () => {
    const slots = [{ color: B, left: 1 }, { color: B, left: 1 }, { color: B, left: 1 }, { color: B, left: 1 }, { color: R, left: 1 }];
    expect(isStuck(makeState(BOX, [], slots))).toBe(false);
  });
});

describe('инвариант сумм', () => {
  it('муравьёв цвета = пикселей цвета после любых ходов', () => {
    let state = makeState(['RRRRR', 'RBBBR', 'RBBBR', 'RRRRR'], [[block(B, 2), block(R, 5)], [block(R, 9), block(B, 4)]]);
    expect(antsByColor(state)).toEqual(pixelsByColor(state));
    for (const move of [0, 1, 0, 1]) {
      state = applyMove(state, move) ?? state;
      expect(antsByColor(state)).toEqual(pixelsByColor(state));
    }
    expect(isWon(state)).toBe(true);
  });
});

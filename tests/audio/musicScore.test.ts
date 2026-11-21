import { describe, expect, it } from 'vitest';
import {
  BARS_PER_PHRASE,
  barScore,
  BPM,
  BREATH_EVERY,
  C_MAJOR,
  MELODY_SCALE,
  progressionOf,
  PROGRESSIONS,
  SECONDS_PER_STEP,
  STEPS_PER_BAR,
  stepsInWindow,
  swingOffset,
} from '../../src/audio/musicScore';

/** Тактов в 10 минутах игры. */
const TEN_MINUTES = Math.ceil((10 * 60) / (SECONDS_PER_STEP * STEPS_PER_BAR));

describe('партитура музыки', () => {
  it('лофи-темп 80–90 BPM', () => {
    expect(BPM).toBeGreaterThanOrEqual(80);
    expect(BPM).toBeLessThanOrEqual(90);
  });

  it('детерминированно: тот же такт — те же ноты', () => {
    for (const bar of [0, 7, 33, 150]) {
      expect(barScore(bar)).toEqual(barScore(bar));
    }
  });

  it('все ноты — из до мажора, мелодия — из пентатоники, шаги в пределах такта', () => {
    for (let bar = 0; bar < TEN_MINUTES; bar++) {
      const score = barScore(bar);
      for (const note of [...score.keys, ...score.bass, ...score.melody]) {
        expect(C_MAJOR, `такт ${bar}`).toContain(note.midi % 12);
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step).toBeLessThan(STEPS_PER_BAR);
      }
      for (const note of score.melody) {
        expect(MELODY_SCALE).toContain(note.midi);
      }
    }
  });

  it('за 10 минут не надоедает: аккорды «колодой» без повтора подряд, мелодии разные', () => {
    const phrases = Math.ceil(TEN_MINUTES / BARS_PER_PHRASE);
    const order = Array.from({ length: phrases }, (_, phrase) => progressionOf(phrase));
    for (let i = 1; i < order.length; i++) {
      expect(order[i], `фраза ${i}`).not.toBe(order[i - 1]);
    }
    // каждые PROGRESSIONS.length фраз — все последовательности по разу
    for (let start = 0; start + PROGRESSIONS.length <= phrases; start += PROGRESSIONS.length) {
      expect(new Set(order.slice(start, start + PROGRESSIONS.length)).size).toBe(PROGRESSIONS.length);
    }
    const melodies = new Set(
      Array.from({ length: phrases }, (_, phrase) =>
        JSON.stringify(Array.from({ length: BARS_PER_PHRASE }, (_, bar) => barScore(phrase * BARS_PER_PHRASE + bar).melody)),
      ),
    );
    // фразы-«вдохи» без мелодии одинаковы, остальные — разные
    expect(melodies.size).toBeGreaterThan(phrases * (1 - 1 / BREATH_EVERY) * 0.9);
  });

  it('«вдох» — каждая BREATH_EVERY-я фраза без мелодии и без бочки', () => {
    const phrase = BREATH_EVERY - 1;
    for (let bar = 0; bar < BARS_PER_PHRASE; bar++) {
      const score = barScore(phrase * BARS_PER_PHRASE + bar);
      expect(score.melody).toEqual([]);
      expect(score.kick).toEqual([]);
    }
  });

  it('раскачка: нечётные шестнадцатые чуть позже, чётные ровно', () => {
    expect(swingOffset(0)).toBe(0);
    expect(swingOffset(1)).toBeGreaterThan(0);
    expect(swingOffset(1)).toBeLessThan(SECONDS_PER_STEP / 2);
  });

  it('планировщик: окно опережения — ровно шаги, которые в нём начинаются', () => {
    const steps = stepsInWindow(10, 10, 10 + SECONDS_PER_STEP * 3.5);
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(stepsInWindow(10, 10 + SECONDS_PER_STEP * 2, 10 + SECONDS_PER_STEP * 4)).toEqual([2, 3]);
    expect(stepsInWindow(10, 5, 9)).toEqual([]);
  });
});

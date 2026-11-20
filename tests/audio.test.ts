import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { groupOf, PHRASES, phrasesOf } from '../src/audio/phrases';
import { COLOR_GAP_MS, pickFromGroup } from '../src/audio/voice';
import { GAME_COLORS } from '../src/ui/palette';
import { process as processVoice } from '../scripts/voice-lib';

const ROOT = join(import.meta.dirname, '..');

/** Строки таблицы фраз из docs/VOICE.md: | `id` | Фраза | Когда |. */
function voiceTable(): { id: string; text: string }[] {
  return readFileSync(join(ROOT, 'docs/VOICE.md'), 'utf8')
    .split('\n')
    .map(line => line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*([^|]+?)\s*\|/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => ({ id: match[1]!, text: match[2]! }));
}

describe('фразы озвучки', () => {
  it('id и тексты в коде — ровно как в docs/VOICE.md', () => {
    expect(PHRASES.map(phrase => ({ id: phrase.id, text: phrase.text }))).toEqual(voiceTable());
  });

  it('у каждой фразы есть файл public/voice/<id>.m4a', () => {
    const missing = PHRASES.filter(phrase => !existsSync(join(ROOT, 'public/voice', `${phrase.id}.m4a`)));
    expect(missing.map(phrase => phrase.id)).toEqual([]);
  });

  it('группы: похвала и подсказка — несколько вариантов, цвет — на каждый цвет палитры', () => {
    expect(phrasesOf('praise')).toHaveLength(7);
    expect(phrasesOf('hint')).toEqual(['hint-1', 'hint-2']);
    expect(groupOf('stuck-back')).toBe('stuck-back');
    for (const color of GAME_COLORS) {
      expect(PHRASES.some(phrase => phrase.id === `color-${color.id}`), color.id).toBe(true);
    }
  });

  it('фраза группы не повторяется подряд', () => {
    const ids = phrasesOf('praise');
    let last: string | undefined;
    for (let i = 0; i < 200; i++) {
      const next = pickFromGroup(ids, last, Math.random)!;
      expect(next).not.toBe(last);
      last = next;
    }
    expect(pickFromGroup(['only'], 'only', Math.random)).toBe('only');
  });

  it('название цвета — не чаще раза в 3 с', () => {
    expect(COLOR_GAP_MS).toBe(3_000);
  });
});

describe('обработка записи (voice:import)', () => {
  it('обрезает тишину по краям и выравнивает громкость, пики не выше −1 dBFS', () => {
    const rate = 44_100;
    const silence = new Float32Array(rate); // 1 с тишины
    const tone = Float32Array.from({ length: rate / 2 }, (_, i) => 0.02 * Math.sin((2 * Math.PI * 440 * i) / rate));
    const input = new Float32Array([...silence, ...tone, ...silence]);
    const output = processVoice(input);
    // 0,5 с звука + запас ~0,17 с, а не 2,5 с
    expect(output.length / rate).toBeGreaterThan(0.5);
    expect(output.length / rate).toBeLessThan(0.75);
    const peak = Math.max(...output.map(Math.abs));
    expect(peak).toBeLessThanOrEqual(0.891);
    expect(peak).toBeGreaterThan(0.1); // тихая запись стала громче
    expect(() => processVoice(new Float32Array(rate))).toThrow();
  });
});

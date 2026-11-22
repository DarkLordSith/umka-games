import { describe, expect, it } from 'vitest';
import { MIX, toDb } from '../../src/audio/mix';

describe('микшер', () => {
  it('голос на 6 dB тише прежнего (0 dB)', () => {
    expect(toDb(MIX.voice)).toBeCloseTo(-6, 0);
  });

  it('под голосом фон приглушён так же относительно голоса, как до правки', () => {
    // было: голос 1, эффекты под голосом 0.35, музыка под голосом 0.17 × 0.2
    expect(toDb(MIX.voice / (MIX.sfx * MIX.sfxUnderVoice))).toBeCloseTo(toDb(1 / 0.35), 1);
    expect(toDb(MIX.voice / (MIX.music * MIX.musicUnderVoice))).toBeCloseTo(toDb(1 / (0.17 * 0.2)), 1);
  });

  it('голос громче фона под ним', () => {
    expect(MIX.voice).toBeGreaterThan(MIX.sfx * MIX.sfxUnderVoice);
    expect(MIX.voice).toBeGreaterThan(MIX.music * MIX.musicUnderVoice);
  });
});

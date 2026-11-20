// Эффекты — синтез Web Audio, без файлов: мягкие и короткие (синус/треугольник,
// плавная атака и затухание, без щелчков). Тихо, если звук ещё не разбужен или выключен.
import { audioContext, sfxOutput } from './engine';

interface Tone {
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly type: OscillatorType;
  readonly volume: number;
  readonly delay?: number;
}

function play(tones: readonly Tone[]): void {
  const context = audioContext();
  const output = sfxOutput();
  if (!context || !output) {
    return;
  }
  const now = context.currentTime;
  for (const tone of tones) {
    const start = now + (tone.delay ?? 0);
    const end = start + tone.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.volume, start + Math.min(0.015, tone.duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

/** Муравьёв много — поедание не чаще раза в EAT_GAP_MS, иначе каша. */
const EAT_GAP_MS = 70;
let lastEat = 0;

export const sfx = {
  /** Тап по блоку: мягкий «чпок» вверх. */
  tap: () => play([{ from: 520, to: 820, duration: 0.07, type: 'sine', volume: 0.16 }]),
  /** Блок встал на место (в слот): короткий глухой «тук». */
  place: () => play([{ from: 320, to: 190, duration: 0.11, type: 'triangle', volume: 0.2 }]),
  /** Муравей съел пиксель: еле слышный «клик». */
  eat: () => {
    const now = performance.now();
    if (now - lastEat < EAT_GAP_MS) {
      return;
    }
    lastEat = now;
    play([{ from: 1100, to: 1500, duration: 0.04, type: 'sine', volume: 0.05 }]);
  },
  /** Нельзя: блок трясётся — низкий короткий «бум». */
  no: () => play([{ from: 200, to: 150, duration: 0.12, type: 'sine', volume: 0.12 }]),
  /** Фишка на карте прыгнула. */
  hop: () => play([{ from: 300, to: 700, duration: 0.18, type: 'sine', volume: 0.12 }]),
  /** Победа: весёлое арпеджио до-ми-соль-до. */
  win: () =>
    play(
      [523, 659, 784, 1047].map((frequency, index) => ({
        from: frequency,
        to: frequency * 1.01,
        duration: index === 3 ? 0.45 : 0.16,
        type: 'triangle' as const,
        volume: 0.16,
        delay: index * 0.11,
      })),
    ),
};

// Фоновая музыка: синтез Web Audio по партитуре musicScore.ts, в общем AudioContext (engine.ts).
// Без файлов и чужих треков.
//
// Планировщик с опережением: раз в SCHEDULE_EVERY_MS (один таймер на всю музыку, не на ноту)
// ставим в часы AudioContext все шаги, которые начнутся в ближайшие LOOKAHEAD_S. Звук
// играет по часам аудио, а не таймера — поэтому без щелчков и «плавания» даже при
// подтормаживании страницы. Отзвучавшие узлы отключаются (onended).
//
// Когда играет: после первого касания, непрерывно в меню, на карте и в уровне (переходы
// между экранами её не трогают). Свернул PWA — плавная пауза и стоп таймера (батарея),
// вернулся — продолжение с того же места. Выключатель «Музыка» — settings.music.
import { audioContext, audioSettings, musicOutput, onAudioReady, onAudioSettings } from './engine';
import { barScore, type BarScore, SECONDS_PER_STEP, STEPS_PER_BAR, swingOffset } from './musicScore';

/** Громкость музыки: фон, RMS ≈ −38 dBFS — на ~7 dB тише «тапа» и на ~20 dB тише голоса (офлайн-рендер). */
export const MUSIC_LEVEL = 0.17;
const LOOKAHEAD_S = 0.2;
const SCHEDULE_EVERY_MS = 50;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 0.8;
/** «Лофи»: срезаем верха. */
const LOWPASS_HZ = 2600;

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Отключить узлы, когда источник отзвучал (иначе граф копится и ест батарею). */
function cleanup(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
  source.onended = () => {
    source.disconnect();
    nodes.forEach(node => node.disconnect());
  };
}

function envelope(gain: GainNode, time: number, attack: number, peak: number, hold: number, release: number): number {
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(peak * 0.35, time + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
  return time + attack + hold + release;
}

/** Тёплое «электропиано»: синус и быстро гаснущий обертон октавой выше. */
export function playKeys(context: BaseAudioContext, out: AudioNode, time: number, midi: number, seconds: number, velocity: number): void {
  const gain = context.createGain();
  const end = envelope(gain, time, 0.012, 0.05 * velocity, seconds, 0.5);
  const body = context.createOscillator();
  body.type = 'sine';
  body.frequency.value = frequency(midi);
  const tine = context.createOscillator();
  tine.type = 'sine';
  tine.frequency.value = frequency(midi + 12);
  const tineGain = context.createGain();
  tineGain.gain.setValueAtTime(0.25, time);
  tineGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
  body.connect(gain);
  tine.connect(tineGain).connect(gain);
  gain.connect(out);
  body.start(time);
  tine.start(time);
  body.stop(end);
  tine.stop(end);
  cleanup(body, gain);
  cleanup(tine, tineGain);
}

/** Бас: мягкий синус. */
export function playBass(context: BaseAudioContext, out: AudioNode, time: number, midi: number, seconds: number, velocity: number): void {
  const gain = context.createGain();
  const end = envelope(gain, time, 0.02, 0.16 * velocity, seconds * 0.7, 0.25);
  const oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency(midi);
  oscillator.connect(gain).connect(out);
  oscillator.start(time);
  oscillator.stop(end);
  cleanup(oscillator, gain);
}

/** Напевка: треугольник, мягкая атака. */
export function playMelody(context: BaseAudioContext, out: AudioNode, time: number, midi: number, seconds: number, velocity: number): void {
  const gain = context.createGain();
  const end = envelope(gain, time, 0.03, 0.045 * velocity, seconds * 0.8, 0.3);
  const oscillator = context.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency(midi);
  oscillator.connect(gain).connect(out);
  oscillator.start(time);
  oscillator.stop(end);
  cleanup(oscillator, gain);
}

/** Мягкая бочка: синус с быстрым падением высоты. */
export function playKick(context: BaseAudioContext, out: AudioNode, time: number, velocity: number): void {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.3 * velocity, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
  const oscillator = context.createOscillator();
  oscillator.frequency.setValueAtTime(110, time);
  oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  oscillator.connect(gain).connect(out);
  oscillator.start(time);
  oscillator.stop(time + 0.3);
  cleanup(oscillator, gain);
}

/** Шум через фильтр: мягкий малый («рим») и хэт. */
export function playNoise(
  context: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  time: number,
  center: number,
  peak: number,
  decay: number,
): void {
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = center;
  filter.Q.value = 0.9;
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  source.connect(filter).connect(gain).connect(out);
  source.start(time, Math.random() * (noise.duration - decay - 0.01));
  source.stop(time + decay + 0.01);
  cleanup(source, filter, gain);
}

export function makeNoise(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Виниловый треск: редкие тихие щелчки и еле слышное шипение, петлёй. */
export function makeCrackle(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.35 : 0) + (Math.random() * 2 - 1) * 0.006;
  }
  return buffer;
}

/** Сыграть один шаг партитуры (global step) в момент time. */
export function playStep(context: BaseAudioContext, out: AudioNode, noise: AudioBuffer, step: number, time: number): void {
  const bar: BarScore = barScore(Math.floor(step / STEPS_PER_BAR));
  const inBar = step % STEPS_PER_BAR;
  const at = time + swingOffset(inBar);
  for (const note of bar.keys) {
    if (note.step === inBar) {
      playKeys(context, out, at, note.midi, note.length * SECONDS_PER_STEP, note.velocity);
    }
  }
  for (const note of bar.bass) {
    if (note.step === inBar) {
      playBass(context, out, at, note.midi, note.length * SECONDS_PER_STEP, note.velocity);
    }
  }
  for (const note of bar.melody) {
    if (note.step === inBar) {
      playMelody(context, out, at, note.midi, note.length * SECONDS_PER_STEP, note.velocity);
    }
  }
  for (const hit of bar.kick) {
    if (hit.step === inBar) {
      playKick(context, out, at, hit.velocity);
    }
  }
  for (const hit of bar.snare) {
    if (hit.step === inBar) {
      playNoise(context, out, noise, at, 1800, 0.05 * hit.velocity, 0.12);
    }
  }
  for (const hit of bar.hat) {
    if (hit.step === inBar) {
      playNoise(context, out, noise, at, 4500, 0.02 * hit.velocity, 0.05);
    }
  }
}

/** Цепочка музыки: громкость (плавный старт/пауза) → лоупасс → канал музыки движка. */
interface Chain {
  readonly fade: GainNode;
  readonly noise: AudioBuffer;
  readonly crackle: AudioBuffer;
}

let chain: Chain | null = null;
let crackleSource: AudioBufferSourceNode | null = null;
let timer = 0;
let stopTimer = 0;
/** Следующий шаг партитуры и его время в часах аудио: после паузы — с того же места. */
let nextStep = 0;
let nextTime = 0;
let playing = false;

function ensureChain(context: AudioContext): Chain | null {
  const output = musicOutput();
  if (!output) {
    return null;
  }
  if (!chain) {
    const fade = context.createGain();
    fade.gain.value = 0.0001;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = LOWPASS_HZ;
    fade.connect(lowpass).connect(output);
    chain = { fade, noise: makeNoise(context), crackle: makeCrackle(context) };
  }
  return chain;
}

function schedule(): void {
  const context = audioContext();
  if (!context || !chain) {
    return;
  }
  // после паузы (свернули PWA) часы ушли вперёд — продолжаем с того же шага, без «догоняния»
  if (nextTime < context.currentTime) {
    nextTime = context.currentTime + 0.05;
  }
  while (nextTime < context.currentTime + LOOKAHEAD_S) {
    playStep(context, chain.fade, chain.noise, nextStep, nextTime);
    nextStep++;
    nextTime += SECONDS_PER_STEP;
  }
}

function start(): void {
  const context = audioContext();
  if (!context || playing || document.visibilityState !== 'visible' || !audioSettings().music) {
    return;
  }
  const current = ensureChain(context);
  if (!current) {
    return;
  }
  playing = true;
  window.clearTimeout(stopTimer);
  const now = context.currentTime;
  const gain = current.fade.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(Math.max(0.0001, gain.value), now);
  gain.exponentialRampToValueAtTime(MUSIC_LEVEL, now + FADE_IN_S);
  if (!crackleSource) {
    crackleSource = context.createBufferSource();
    crackleSource.buffer = current.crackle;
    crackleSource.loop = true;
    crackleSource.connect(current.fade);
    crackleSource.start();
  }
  nextTime = Math.max(nextTime, now + 0.05);
  schedule();
  window.clearInterval(timer);
  timer = window.setInterval(schedule, SCHEDULE_EVERY_MS);
}

function stop(): void {
  const context = audioContext();
  if (!playing) {
    return;
  }
  playing = false;
  window.clearInterval(timer);
  if (context && chain) {
    const now = context.currentTime;
    const gain = chain.fade.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.exponentialRampToValueAtTime(0.0001, now + FADE_OUT_S);
  }
  // после затухания — без лишних узлов: треск останавливаем
  window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    crackleSource?.stop();
    crackleSource?.disconnect();
    crackleSource = null;
  }, FADE_OUT_S * 1000 + 100);
}

/** Привести музыку в соответствие: играть ли сейчас. */
function sync(): void {
  if (audioSettings().music && document.visibilityState === 'visible') {
    start();
  } else {
    stop();
  }
}

/** Подключить музыку: старт после первого касания, выключатель, пауза в фоне. Один раз в main.tsx. */
export function installMusic(): void {
  // контекст разбужен касанием — первым тиком часов музыка ещё не может стартовать (state
  // становится running асинхронно), поэтому пробуем чуть позже
  onAudioReady(() => window.setTimeout(sync, 120));
  onAudioSettings(sync);
  document.addEventListener('visibilitychange', () => window.setTimeout(sync, 120));
  document.addEventListener('pointerdown', sync, { passive: true });
}

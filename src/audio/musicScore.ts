// Партитура фоновой музыки — светлое лофи. Чистые функции: номер такта → что в нём звучит.
// Звук по ней делает music.ts. Детерминированно: тот же такт → те же ноты (тестируется).
//
// Устройство:
//   - до мажор, 86 BPM, такт = 16 шагов (шестнадцатые), лёгкая «раскачка» нечётных шагов;
//   - фраза = 4 такта = одна последовательность аккордов (по аккорду на такт);
//   - последовательностей PROGRESSIONS.length, они идут «колодой»: в каждом круге все по
//     разу в случайном порядке, на стыке кругов подряд одна не повторяется;
//   - мелодия-напевка из пентатоники сочиняется заново на каждую фразу (сильные доли —
//     звуки аккорда), каждая BREATH_EVERY-я фраза — без мелодии и с лёгкими ударными («вдох»).
import { mulberry32 } from '../engine/rng';

export const BPM = 86;
export const STEPS_PER_BAR = 16;
export const BARS_PER_PHRASE = 4;
/** Доля шага, на которую опаздывают нечётные шестнадцатые (swing). */
export const SWING = 0.28;
/** Каждая такая фраза — «вдох»: без мелодии, ударные тише. */
export const BREATH_EVERY = 5;

export const SECONDS_PER_STEP = 60 / BPM / 4;

export interface Chord {
  readonly name: string;
  /** Бас (MIDI). */
  readonly root: number;
  /** Аккорд для электропиано (MIDI), мягкие maj7/add9 без корня — корень играет бас. */
  readonly notes: readonly number[];
}

const C: Chord = { name: 'Cmaj9', root: 36, notes: [52, 55, 59, 62] };
const AM: Chord = { name: 'Am7', root: 33, notes: [55, 57, 60, 64] };
const F: Chord = { name: 'Fmaj7', root: 41, notes: [53, 57, 60, 64] };
const G: Chord = { name: 'G6', root: 43, notes: [55, 59, 62, 64] };
const EM: Chord = { name: 'Em7', root: 40, notes: [52, 55, 59, 62] };
const DM: Chord = { name: 'Dm9', root: 38, notes: [53, 57, 60, 64] };

/** Последовательности аккордов, по 4 такта. */
export const PROGRESSIONS: readonly (readonly Chord[])[] = [
  [C, AM, F, G],
  [F, G, EM, AM],
  [AM, F, C, G],
  [F, C, DM, G],
  [DM, G, C, AM],
];

/** До-мажорная пентатоника (до, ре, ми, соль, ля) в регистре напевки. */
export const MELODY_SCALE: readonly number[] = [67, 69, 72, 74, 76, 79, 81];
/** Звукоряд до мажора (для теста: всё по-доброму, без «чужих» нот). */
export const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

export interface Note {
  /** Шаг в такте, 0…15. */
  readonly step: number;
  readonly midi: number;
  /** Длительность в шагах. */
  readonly length: number;
  /** Громкость 0…1 (дальше масштабирует синтезатор). */
  readonly velocity: number;
}

export interface Hit {
  readonly step: number;
  readonly velocity: number;
}

export interface BarScore {
  readonly bar: number;
  readonly phrase: number;
  readonly chord: Chord;
  /** Удары аккорда электропиано (все ноты аккорда разом). */
  readonly keys: readonly Note[];
  readonly bass: readonly Note[];
  readonly melody: readonly Note[];
  readonly kick: readonly Hit[];
  readonly snare: readonly Hit[];
  readonly hat: readonly Hit[];
}

/** Ритмы мелодии на такт: [шаг, длина]. Пустой — пауза. */
const MELODY_RHYTHMS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 4], [6, 2], [8, 6]],
  [[2, 2], [4, 2], [6, 4], [12, 4]],
  [[0, 2], [3, 3], [8, 2], [10, 6]],
  [[4, 4], [10, 2], [12, 4]],
  [[0, 6], [8, 8]],
  [[0, 3], [3, 3], [6, 2], [8, 8]],
  [],
];

/** Аккомпанемент электропиано: [шаг, длина, громкость]. */
const KEYS_PATTERNS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[0, 16, 1]],
  [[0, 8, 1], [8, 8, 0.7]],
  [[0, 6, 1], [6, 10, 0.75]],
  [[0, 10, 1], [10, 6, 0.6]],
];

/** Бас: [шаг, длина, на сколько полутонов от корня]. */
const BASS_PATTERNS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[0, 6, 0], [8, 6, 0]],
  [[0, 8, 0], [10, 4, 7]],
  [[0, 6, 0], [6, 2, 0], [10, 6, 12]],
];

/** Ударные: бочка, «рим» (мягкий малый) и хэты по шагам. */
const DRUM_PATTERNS: readonly { kick: number[]; snare: number[]; hat: number[] }[] = [
  { kick: [0, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14, 15] },
  { kick: [0, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14] },
];

const seeded = (salt: number, index: number) => mulberry32((index + 1) * 7_919 + salt * 104_729);

/** Порядок последовательностей в круге c («колода»): на стыке кругов подряд одна не идёт. */
function cycleOrder(cycle: number): number[] {
  const order = shuffled(PROGRESSIONS.length, seeded(1, cycle));
  if (cycle > 0) {
    const previous = shuffled(PROGRESSIONS.length, seeded(1, cycle - 1));
    // последний элемент круга перестановкой первых двух не меняется — сравнивать с сырым можно
    if (order[0] === previous[previous.length - 1]) {
      [order[0], order[1]] = [order[1]!, order[0]!];
    }
  }
  return order;
}

function shuffled(count: number, rng: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** Номер последовательности аккордов фразы. */
export function progressionOf(phrase: number): number {
  const count = PROGRESSIONS.length;
  return cycleOrder(Math.floor(phrase / count))[phrase % count]!;
}

/** Ближайшая к индексу ступень пентатоники, которая звучит в аккорде (для сильных долей). */
function chordTone(index: number, chord: Chord): number {
  const classes = new Set(chord.notes.map(note => note % 12));
  for (let distance = 0; distance < MELODY_SCALE.length; distance++) {
    for (const candidate of [index - distance, index + distance]) {
      if (candidate >= 0 && candidate < MELODY_SCALE.length && classes.has(MELODY_SCALE[candidate]! % 12)) {
        return candidate;
      }
    }
  }
  return index;
}

/** Мелодия фразы: 4 такта, плавное движение по пентатонике, конец — долгий звук аккорда. */
function phraseMelody(phrase: number): Note[][] {
  if (phrase % BREATH_EVERY === BREATH_EVERY - 1) {
    return [[], [], [], []];
  }
  const rng = seeded(2, phrase);
  const progression = PROGRESSIONS[progressionOf(phrase)]!;
  let index = 2 + Math.floor(rng() * 3);
  return progression.map((chord, bar) => {
    // последний такт — либо пауза, либо один долгий звук аккорда: фраза «выдыхает»
    const rhythm =
      bar === BARS_PER_PHRASE - 1
        ? rng() < 0.5
          ? []
          : [[0, 12] as const]
        : MELODY_RHYTHMS[Math.floor(rng() * MELODY_RHYTHMS.length)]!;
    return rhythm.map(([step, length]) => {
      const move = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]!;
      index = Math.max(0, Math.min(MELODY_SCALE.length - 1, index + move));
      if (step % 8 === 0) {
        index = chordTone(index, chord);
      }
      return { step, midi: MELODY_SCALE[index]!, length, velocity: step % 4 === 0 ? 1 : 0.8 };
    });
  });
}

const melodyCache = new Map<number, Note[][]>();

/** Что звучит в такте bar (с 0). */
export function barScore(bar: number): BarScore {
  const index = Math.max(0, Math.floor(bar));
  const phrase = Math.floor(index / BARS_PER_PHRASE);
  const inPhrase = index % BARS_PER_PHRASE;
  const chord = PROGRESSIONS[progressionOf(phrase)]![inPhrase]!;
  const rng = seeded(3, phrase);
  const keysPattern = KEYS_PATTERNS[Math.floor(rng() * KEYS_PATTERNS.length)]!;
  const bassPattern = BASS_PATTERNS[Math.floor(rng() * BASS_PATTERNS.length)]!;
  const drums = DRUM_PATTERNS[Math.floor(rng() * DRUM_PATTERNS.length)]!;
  const breath = phrase % BREATH_EVERY === BREATH_EVERY - 1;

  let melody = melodyCache.get(phrase);
  if (!melody) {
    melody = phraseMelody(phrase);
    melodyCache.set(phrase, melody);
    if (melodyCache.size > 64) {
      melodyCache.delete(melodyCache.keys().next().value!);
    }
  }

  const hatRng = seeded(4, index);
  return {
    bar: index,
    phrase,
    chord,
    keys: keysPattern.flatMap(([step, length, velocity]) => chord.notes.map(midi => ({ step, midi, length, velocity }))),
    bass: bassPattern.map(([step, length, offset]) => ({ step, midi: chord.root + offset, length, velocity: 1 })),
    melody: melody[inPhrase]!,
    // «вдох» — без бочки и малого, только тихие хэты
    kick: breath ? [] : drums.kick.map(step => ({ step, velocity: step === 0 ? 1 : 0.7 })),
    snare: breath ? [] : drums.snare.map(step => ({ step, velocity: 0.8 })),
    hat: drums.hat.map(step => ({ step, velocity: (breath ? 0.5 : 1) * (0.6 + hatRng() * 0.4) * (step % 4 === 0 ? 1 : 0.8) })),
  };
}

/** Смещение шага от сетки: нечётные шестнадцатые чуть опаздывают (раскачка). */
export function swingOffset(step: number): number {
  return step % 2 === 1 ? SWING * SECONDS_PER_STEP : 0;
}

/**
 * Планировщик: какие шаги (глобальный номер шага) попадают в окно [from, until)
 * при старте шага 0 в момент origin. Чистая функция — звук ставится с опережением.
 */
export function stepsInWindow(origin: number, from: number, until: number): number[] {
  const first = Math.max(0, Math.ceil((from - origin) / SECONDS_PER_STEP - 1e-9));
  const steps: number[] = [];
  for (let step = first; origin + step * SECONDS_PER_STEP < until; step++) {
    steps.push(step);
  }
  return steps;
}

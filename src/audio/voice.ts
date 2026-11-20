// Голос: файлы public/voice/<id>.m4a (сейчас — заглушка Milena, потом записи владельца;
// подмена файла не требует правок кода). Нет файла или не загрузился — тишина.
// Одновременно звучит одна фраза; пока она звучит, эффекты тише.
import { audioContext, duckSfx, onAudioReady, voiceOutput } from './engine';
import { PHRASES, phrasesOf } from './phrases';

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;
/** Номер последней просьбы: фраза, которая загрузилась позже более новой, не играет. */
let request = 0;

function load(context: AudioContext, id: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(id);
  if (!buffer) {
    buffer = fetch(`${import.meta.env.BASE_URL}voice/${id}.m4a`)
      .then(response => (response.ok ? response.arrayBuffer() : null))
      .then(data => (data ? context.decodeAudioData(data) : null))
      .catch(() => null);
    buffers.set(id, buffer);
  }
  return buffer;
}

// звук разбужен — подгружаем все фразы заранее (их ~25, маленькие), чтобы первая не опаздывала
onAudioReady(() => {
  const context = audioContext();
  if (context) {
    PHRASES.forEach(phrase => void load(context, phrase.id));
  }
});

/** Сказать фразу. Новая фраза обрывает предыдущую. */
export function say(id: string): void {
  const context = audioContext();
  if (!context || !voiceOutput()) {
    return;
  }
  const ticket = ++request;
  void load(context, id).then(buffer => {
    const output = voiceOutput();
    if (!buffer || !output || ticket !== request) {
      return;
    }
    current?.stop();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    source.start();
    current = source;
    duckSfx(buffer.duration);
  });
}

/** Следующая фраза группы: случайная, но не та же, что в прошлый раз. */
export function pickFromGroup(ids: readonly string[], last: string | undefined, random: () => number): string | undefined {
  const choices = ids.length > 1 ? ids.filter(id => id !== last) : ids;
  return choices[Math.floor(random() * choices.length)];
}

const lastInGroup = new Map<string, string>();

/** Случайная фраза группы (praise, hint, …) без повтора подряд. */
export function sayFrom(group: string): void {
  const id = pickFromGroup(phrasesOf(group), lastInGroup.get(group), Math.random);
  if (id) {
    lastInGroup.set(group, id);
    say(id);
  }
}

/** Название цвета по касанию блока — не чаще раза в COLOR_GAP_MS, чтобы не тараторить. */
export const COLOR_GAP_MS = 3_000;
let lastColor = -Infinity;

export function sayColor(colorId: string): void {
  const now = performance.now();
  if (now - lastColor < COLOR_GAP_MS) {
    return;
  }
  lastColor = now;
  say(`color-${colorId}`);
}

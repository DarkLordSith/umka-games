// Обработка записей голоса: любой аудиофайл → обрезка тишины, выравнивание громкости,
// моно AAC → public/voice/<id>.m4a. Декодирует и кодирует встроенный в macOS afconvert
// (ставить ничего не нужно); тишину и громкость считаем сами по сэмплам.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { PHRASES } from '../src/audio/phrases.ts';

export const VOICE_DIR = new URL('../public/voice/', import.meta.url).pathname;

const RATE = 44_100;
/** Тише этого (dBFS, по окнам 10 мс) — тишина по краям. */
const SILENCE_DB = -45;
/** Оставить тишины перед фразой и после, с. */
const PAD_BEFORE = 0.05;
const PAD_AFTER = 0.12;
/** Целевая средняя громкость (RMS, dBFS) и потолок пиков. */
const TARGET_RMS_DB = -18;
const PEAK_LIMIT = 0.89; // −1 dBFS
const FADE = 0.01;
const AUDIO = new Set(['.m4a', '.wav', '.aif', '.aiff', '.caf', '.mp3', '.mp4', '.aac']);

const db = (value: number) => 10 ** (value / 20);

/** WAV 16 бит моно → сэмплы −1…1 (ищем чанк data, остальные пропускаем). */
function readWav(file: string): Float32Array {
  const data = readFileSync(file);
  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (id === 'data') {
      const count = Math.floor(Math.min(size, data.length - offset - 8) / 2);
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        samples[i] = data.readInt16LE(offset + 8 + i * 2) / 32_768;
      }
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${file}: в WAV нет данных`);
}

function writeWav(file: string, samples: Float32Array): void {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // моно
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32_767), 44 + i * 2));
  writeFileSync(file, buffer);
}

/** Обрезать тишину по краям, выровнять громкость, плавные края. */
export function process(samples: Float32Array): Float32Array {
  const window = Math.round(RATE * 0.01);
  const loud: number[] = [];
  for (let start = 0; start + window <= samples.length; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i++) {
      sum += samples[i]! ** 2;
    }
    if (Math.sqrt(sum / window) > db(SILENCE_DB)) {
      loud.push(start);
    }
  }
  if (loud.length === 0) {
    throw new Error('в записи одна тишина');
  }
  const from = Math.max(0, loud[0]! - Math.round(RATE * PAD_BEFORE));
  const to = Math.min(samples.length, loud[loud.length - 1]! + window + Math.round(RATE * PAD_AFTER));
  const trimmed = samples.slice(from, to);
  let sum = 0;
  let peak = 0;
  for (const sample of trimmed) {
    sum += sample ** 2;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sum / trimmed.length);
  const gain = Math.min(db(TARGET_RMS_DB) / rms, PEAK_LIMIT / peak);
  const fade = Math.round(RATE * FADE);
  return trimmed.map((sample, i) => sample * gain * Math.min(1, i / fade, (trimmed.length - 1 - i) / fade));
}

/** Папка с файлами «<id>.<любое аудио>» → public/voice/<id>.m4a. Возвращает обработанные id. */
export function importFolder(folder: string): string[] {
  const known = new Set(PHRASES.map(phrase => phrase.id));
  const temp = mkdtempSync(join(tmpdir(), 'umka-voice-'));
  const done: string[] = [];
  try {
    for (const name of readdirSync(folder).sort()) {
      const ext = extname(name).toLowerCase();
      if (!AUDIO.has(ext)) {
        continue;
      }
      const id = basename(name, extname(name));
      if (!known.has(id)) {
        console.warn(`пропуск ${name}: нет фразы «${id}» в src/audio/phrases.ts (docs/VOICE.md)`);
        continue;
      }
      const raw = join(temp, `${id}.raw.wav`);
      const clean = join(temp, `${id}.wav`);
      const out = join(VOICE_DIR, `${id}.m4a`);
      execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${RATE}`, '-c', '1', '--mix', join(folder, name), raw]);
      const samples = process(readWav(raw));
      writeWav(clean, samples);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', clean, out]);
      console.log(`${id}.m4a  ${(samples.length / RATE).toFixed(2)} с`);
      done.push(id);
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  const missing = [...known].filter(id => !done.includes(id));
  if (missing.length > 0) {
    console.log(`без новой записи (остались прежние файлы): ${missing.join(', ')}`);
  }
  return done;
}

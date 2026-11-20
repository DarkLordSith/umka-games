// npm run voice:import <папка> — записи «<id>.m4a» (или wav, aiff…) из папки →
// public/voice/<id>.m4a: обрезка тишины, громкость, моно AAC. id — из docs/VOICE.md.
import { existsSync } from 'node:fs';
import { importFolder } from './voice-lib.ts';

const folder = process.argv[2];
if (!folder || !existsSync(folder)) {
  console.error('Использование: npm run voice:import <папка с файлами <id>.m4a>');
  process.exit(1);
}
const done = importFolder(folder);
console.log(`готово: ${done.length} файл(ов) в public/voice/`);

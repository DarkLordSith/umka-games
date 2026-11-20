// npm run voice:placeholder — временный голос: все фразы из src/audio/phrases.ts
// голосом Milena из macOS (`say`), затем та же обработка, что у voice:import.
// Записи владельца потом просто подменяют файлы (npm run voice:import <папка>).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PHRASES } from '../src/audio/phrases.ts';
import { importFolder } from './voice-lib.ts';

const voices = execFileSync('say', ['-v', '?'], { encoding: 'utf8' });
// улучшенная Milena звучит заметно живее; нет её — обычная
const voice = ['Milena (Enhanced)', 'Milena'].find(name => voices.split('\n').some(line => line.startsWith(`${name} `)));
if (!voice) {
  console.error(
    [
      'Нет голоса Milena. Как поставить:',
      '  Системные настройки → Универсальный доступ → Устной контент → Системный голос →',
      '  Управление голосами… → Русский → Milena (лучше «улучшенный»), загрузить.',
      'Потом снова: npm run voice:placeholder',
    ].join('\n'),
  );
  process.exit(1);
}

const temp = mkdtempSync(join(tmpdir(), 'umka-milena-'));
try {
  for (const phrase of PHRASES) {
    execFileSync('say', ['-v', voice, '-r', '165', '-o', join(temp, `${phrase.id}.aiff`), phrase.text]);
  }
  console.log(`голос: ${voice}`);
  importFolder(temp);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

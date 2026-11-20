import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROKEN_KEY, type KeyValueStorage, loadProgress, PROGRESS_KEY, saveProgress } from '../src/app/storage';
import {
  defaultProgress,
  gameProgress,
  migrate,
  parseProgress,
  PROGRESS_VERSION,
  withGame,
  withoutGame,
  withSettings,
} from '../src/engine/progress';
import { makeLevel } from '../src/games/ants/generator';

const FIXTURES = join(import.meta.dirname, 'fixtures');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

/** Память вместо localStorage. */
function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: key => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('прогресс', () => {
  it('каждая фикстура прошлых версий загружается в текущую схему', () => {
    const files = readdirSync(FIXTURES).filter(file => file.startsWith('progress-'));
    expect(files).toEqual(expect.arrayContaining(['progress-v1.json', 'progress-v2.json']));
    for (const file of files) {
      const progress = migrate(JSON.parse(fixture(file)));
      expect(progress.v, file).toBe(PROGRESS_VERSION);
      expect(progress.games.ants?.difficulty, file).toBeGreaterThanOrEqual(1);
    }
  });

  it('v1 → v2: уровень муравьёв L — сложность L, seed L, пройдено L − 1', () => {
    const progress = loadProgress(memoryStorage({ [PROGRESS_KEY]: fixture('progress-v1.json') }));
    expect(progress.games.ants).toEqual({ difficulty: 7, streak: 0, won: 6, seed: 7 });
    expect(progress.stickers).toEqual([]);
    expect(progress.settings).toEqual({ sfx: true, voice: true });
  });

  it('после обновления — тот же самый уровень муравьёв, что был в v1', () => {
    // v1 строил уровень L как makeLevel(L, L). Картинка у него уже другая (картинок стало больше),
    // но сложность и номер уровня те же.
    const ants = migrate(JSON.parse(fixture('progress-v1.json'))).games.ants!;
    expect(makeLevel(ants.difficulty, ants.seed)).toEqual(makeLevel(7, 7));
  });

  it('v2 читается как есть', () => {
    expect(migrate(JSON.parse(fixture('progress-v2.json')))).toEqual({
      v: 2,
      games: { ants: { difficulty: 12, streak: -1, won: 15, seed: 16 } },
      stickers: [0, 1, 2, 3],
      settings: { sfx: true, voice: false },
    });
  });

  it('нет сохранения — чистый прогресс; игра без записи стартует со своей сложности', () => {
    expect(loadProgress(memoryStorage())).toEqual(defaultProgress());
    expect(loadProgress(null)).toEqual(defaultProgress());
    expect(gameProgress(defaultProgress(), 'ants', 4)).toEqual({ difficulty: 4, streak: 0, won: 0, seed: 1 });
  });

  it('битый JSON — чистый прогресс, старое значение копируется в umka-progress-broken', () => {
    const storage = memoryStorage({ [PROGRESS_KEY]: '{"v":2,"games":' });
    expect(loadProgress(storage)).toEqual(defaultProgress());
    expect(storage.data[BROKEN_KEY]).toBe('{"v":2,"games":');
  });

  it('чужая схема или версия новее — тоже как битый', () => {
    for (const text of ['[]', '"x"', '{"games":{}}', '{"v":99,"games":{}}', '{"v":0}']) {
      expect(parseProgress(text).broken, text).toBe(true);
    }
  });

  it('недостающие и неверные поля — значения по умолчанию, мусор отбрасывается', () => {
    const progress = migrate({
      v: 2,
      games: { ants: { difficulty: -3, streak: 'x', won: 2.5 }, junk: 5 },
      stickers: [3, 3, -1, 'a', 7],
      settings: { sfx: 'yes' },
    });
    expect(progress.games).toEqual({ ants: { difficulty: 1, streak: 0, won: 0, seed: 1 } });
    expect(progress.stickers).toEqual([3, 7]);
    expect(progress.settings).toEqual({ sfx: true, voice: true });
    expect(migrate({ v: 1, games: { ants: { level: 2.5 } } }).games.ants?.difficulty).toBe(1);
  });

  it('хранилище бросает (приватный режим) — без падения', () => {
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadProgress(throwing)).toEqual(defaultProgress());
    expect(() => saveProgress(defaultProgress(), throwing)).not.toThrow();
  });

  it('сохранить и загрузить — тот же прогресс', () => {
    const storage = memoryStorage();
    const progress = withGame(defaultProgress(), 'ants', { difficulty: 5, streak: 2, won: 9, seed: 10 });
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });
});

describe('родительский экран: сброс и настройки', () => {
  it('сброс игры убирает только её запись', () => {
    const progress = withGame(withGame(defaultProgress(), 'ants', { difficulty: 9, streak: 0, won: 8, seed: 9 }), 'other', {
      difficulty: 2,
      streak: 0,
      won: 1,
      seed: 2,
    });
    const reset = withoutGame(progress, 'ants');
    expect(reset.games.ants).toBeUndefined();
    expect(reset.games.other).toEqual(progress.games.other);
    expect(gameProgress(reset, 'ants', 1)).toEqual({ difficulty: 1, streak: 0, won: 0, seed: 1 });
  });

  it('настройки меняются по одной', () => {
    expect(withSettings(defaultProgress(), { voice: false }).settings).toEqual({ sfx: true, voice: false });
  });
});

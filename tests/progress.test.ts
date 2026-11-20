import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROKEN_KEY, type KeyValueStorage, loadProgress, PROGRESS_KEY, saveProgress } from '../src/app/storage';
import { defaultProgress, migrate, parseProgress, PROGRESS_VERSION, withAntsLevel } from '../src/engine/progress';

const FIXTURES = join(import.meta.dirname, 'fixtures');

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
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const progress = migrate(JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')));
      expect(progress.v, file).toBe(PROGRESS_VERSION);
      expect(progress.games.ants.level, file).toBeGreaterThanOrEqual(1);
    }
  });

  it('v1: уровень муравьёв сохраняется', () => {
    const text = readFileSync(join(FIXTURES, 'progress-v1.json'), 'utf8');
    expect(loadProgress(memoryStorage({ [PROGRESS_KEY]: text })).games.ants.level).toBe(7);
  });

  it('нет сохранения — чистый прогресс с 1-го уровня', () => {
    expect(loadProgress(memoryStorage())).toEqual(defaultProgress());
    expect(loadProgress(null)).toEqual(defaultProgress());
  });

  it('битый JSON — чистый прогресс, старое значение копируется в umka-progress-broken', () => {
    const storage = memoryStorage({ [PROGRESS_KEY]: '{"v":1,"games":' });
    expect(loadProgress(storage)).toEqual(defaultProgress());
    expect(storage.data[BROKEN_KEY]).toBe('{"v":1,"games":');
  });

  it('чужая схема или версия новее — тоже как битый', () => {
    for (const text of ['[]', '"x"', '{"games":{}}', '{"v":99,"games":{}}']) {
      expect(parseProgress(text).broken, text).toBe(true);
    }
  });

  it('недостающие и неверные поля — значения по умолчанию', () => {
    expect(migrate({ v: 1 }).games.ants.level).toBe(1);
    expect(migrate({ v: 1, games: { ants: { level: -3 } } }).games.ants.level).toBe(1);
    expect(migrate({ v: 1, games: { ants: { level: 2.5 } } }).games.ants.level).toBe(1);
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
    const progress = withAntsLevel(defaultProgress(), 12);
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROKEN_KEY, type KeyValueStorage, loadProgress, PROGRESS_KEY, saveProgress } from '../src/app/storage';
import {
  defaultProgress,
  gameProgress,
  levelsWon,
  migrate,
  parseProgress,
  PROGRESS_VERSION,
  withGame,
  withoutGame,
  withSettings,
} from '../src/engine/progress';
import { antsGame } from '../src/games/ants';

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
    expect(files).toEqual(expect.arrayContaining(['progress-v1.json', 'progress-v2.json', 'progress-v3.json']));
    for (const file of files) {
      const progress = migrate(JSON.parse(fixture(file)));
      expect(progress.v, file).toBe(PROGRESS_VERSION);
      expect(progress.games.ants?.difficulty, file).toBeGreaterThanOrEqual(1);
    }
  });

  it('v1 → v3: уровень муравьёв L — сложность L, seed L, пройдено L − 1', () => {
    const progress = loadProgress(memoryStorage({ [PROGRESS_KEY]: fixture('progress-v1.json') }));
    const ants = progress.games.ants!;
    expect(ants).toMatchObject({ difficulty: 7, streak: 0, seed: 7 });
    expect(levelsWon(ants)).toBe(6);
    expect(progress.stickers).toEqual([]);
    expect(progress.settings).toEqual({ sfx: true, voice: true });
  });

  it('v2 → v3: номер текущей точки = прежний уровень, история восстановлена приближённо', () => {
    const progress = migrate(JSON.parse(fixture('progress-v2.json')));
    const ants = progress.games.ants!;
    expect(ants).toMatchObject({ difficulty: 12, streak: -1, seed: 16 });
    // было пройдено 15 → текущая точка 16
    expect(levelsWon(ants)).toBe(15);
    // уровень i: seed i, сложность min(i, текущая), картинка, что seed i давал в v2 (10 по кругу)
    expect(ants.levels[0]).toEqual({ difficulty: 1, seed: 1, variant: 'apple' });
    expect(ants.levels[6]).toEqual({ difficulty: 7, seed: 7, variant: 'cat' });
    expect(ants.levels[10]).toEqual({ difficulty: 11, seed: 11, variant: 'apple' });
    expect(ants.levels[14]).toEqual({ difficulty: 12, seed: 15, variant: 'mushroom' });
    expect(progress.stickers).toEqual([0, 1, 2, 3]);
    expect(progress.settings).toEqual({ sfx: true, voice: false });
  });

  it('v3 читается как есть', () => {
    expect(migrate(JSON.parse(fixture('progress-v3.json')))).toEqual(JSON.parse(fixture('progress-v3.json')));
  });

  it('пройденный уровень открывается тем же самым, даже если его картинки уже нет', () => {
    const ants = migrate(JSON.parse(fixture('progress-v3.json'))).games.ants!;
    for (const level of ants.levels) {
      expect(antsGame.makeLevel(level)).toEqual(antsGame.makeLevel({ ...level }));
    }
  });

  it('нет сохранения — чистый прогресс; игра без записи стартует со своей сложности', () => {
    expect(loadProgress(memoryStorage())).toEqual(defaultProgress());
    expect(loadProgress(null)).toEqual(defaultProgress());
    expect(gameProgress(defaultProgress(), 'ants', 4)).toEqual({ difficulty: 4, streak: 0, seed: 1, levels: [] });
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
      v: 3,
      games: { ants: { difficulty: -3, streak: 'x', levels: [{ seed: 2, difficulty: 0 }, 'x', { difficulty: 3 }] }, junk: 5 },
      stickers: [3, 3, -1, 'a', 7],
      settings: { sfx: 'yes' },
    });
    expect(progress.games).toEqual({
      ants: { difficulty: 1, streak: 0, seed: 1, levels: [{ difficulty: 1, seed: 2, variant: null }] },
    });
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
    const progress = withGame(defaultProgress(), 'ants', {
      difficulty: 5,
      streak: 2,
      seed: 10,
      levels: [{ difficulty: 4, seed: 9, variant: 'cake' }],
    });
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });
});

describe('родительский экран: сброс и настройки', () => {
  it('сброс игры убирает только её запись', () => {
    const progress = withGame(withGame(defaultProgress(), 'ants', { difficulty: 9, streak: 0, seed: 9, levels: [] }), 'other', {
      difficulty: 2,
      streak: 0,
      seed: 2,
      levels: [{ difficulty: 1, seed: 1, variant: null }],
    });
    const reset = withoutGame(progress, 'ants');
    expect(reset.games.ants).toBeUndefined();
    expect(reset.games.other).toEqual(progress.games.other);
    expect(gameProgress(reset, 'ants', 1)).toEqual({ difficulty: 1, streak: 0, seed: 1, levels: [] });
  });

  it('настройки меняются по одной', () => {
    expect(withSettings(defaultProgress(), { voice: false }).settings).toEqual({ sfx: true, voice: false });
  });
});

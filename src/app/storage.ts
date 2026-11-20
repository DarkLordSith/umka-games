// Хранилище прогресса. Единственное место, где приложение трогает localStorage.
import { parseProgress, type Progress } from '../engine/progress';

export const PROGRESS_KEY = 'umka-progress';
/** Сюда копируется нечитаемый прогресс, чтобы его можно было достать руками. */
export const BROKEN_KEY = 'umka-progress-broken';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage или null: в приватном режиме или с запретом сайта доступ бросает. */
function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadProgress(storage: KeyValueStorage | null = browserStorage()): Progress {
  let text: string | null = null;
  try {
    text = storage?.getItem(PROGRESS_KEY) ?? null;
  } catch {
    text = null;
  }
  const { progress, broken } = parseProgress(text);
  if (broken && text !== null) {
    try {
      storage?.setItem(BROKEN_KEY, text);
    } catch {
      // нет места или доступа — играть это не мешает
    }
  }
  return progress;
}

export function saveProgress(progress: Progress, storage: KeyValueStorage | null = browserStorage()): void {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // переполнено или запрещено — прогресс останется в памяти до закрытия
  }
}

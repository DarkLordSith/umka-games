// История уровня — массив неизменяемых снимков: первый — старт, последний — текущий.
// Undo без ограничений: просто откусываем последний снимок. Снимки не копируются,
// поэтому логика игр обязана не мутировать состояние.

export interface History<S> {
  readonly snapshots: readonly S[];
}

export function createHistory<S>(initial: S): History<S> {
  return { snapshots: [initial] };
}

export function current<S>(history: History<S>): S {
  return history.snapshots[history.snapshots.length - 1]!;
}

export function push<S>(history: History<S>, snapshot: S): History<S> {
  return { snapshots: [...history.snapshots, snapshot] };
}

export function canUndo<S>(history: History<S>): boolean {
  return history.snapshots.length > 1;
}

/** Шаг назад; на старте уровня возвращает ту же историю. */
export function undo<S>(history: History<S>): History<S> {
  return canUndo(history) ? { snapshots: history.snapshots.slice(0, -1) } : history;
}

/** Уже на старте (сразу после начала или после «заново») — «заново» ничего не даст. */
export function atStart<S>(history: History<S>): boolean {
  return current(history) === history.snapshots[0];
}

/**
 * «Заново» — обычный шаг истории: стартовый снимок кладётся поверх, и Undo
 * возвращает к состоянию до «заново» (случайный тап не стирает уровень).
 * Уже на старте — та же история, чтобы не копить пустые шаги.
 */
export function restart<S>(history: History<S>): History<S> {
  return atStart(history) ? history : push(history, history.snapshots[0]!);
}

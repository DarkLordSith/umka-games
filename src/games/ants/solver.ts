// Решатель муравьёв: поиск в глубину с мемоизацией по состоянию.
// Генератор проверяет им решаемость уровня, экран берёт подсказку (hint).
import { type AntsMove, type AntsState, applyMove, canEat, isStuck, isWon, legalMoves } from './logic';

/** Предел узлов поиска по умолчанию: решатель не должен подвешивать телефон. */
export const DEFAULT_MAX_NODES = 20_000;

export interface SearchOptions {
  /** Сколько состояний можно раскрыть; превысили — ответ «не знаю» (см. функции). */
  readonly maxNodes?: number;
}

/** Ключ состояния: картинка, длины колонок (блоки уходят только сверху) и слоты. */
export function stateKey(state: AntsState): string {
  // картинка — одним вызовом fromCharCode (в разы быстрее склейки по символу): '@' — пусто, 'A'… — цвета
  const codes = new Array<number>(state.pixels.length);
  for (let index = 0; index < state.pixels.length; index++) {
    codes[index] = 65 + state.pixels[index]!;
  }
  let key = String.fromCharCode(...codes);
  key += '|';
  for (const blocks of state.columns) {
    key += `${blocks.length},`;
  }
  key += '|';
  for (const slot of state.slots) {
    key += slot ? `${slot.color}:${slot.left},` : '-,';
  }
  return key;
}

/**
 * Порядок перебора: сначала колонки, чей верхний блок может есть сразу
 * (он не займёт слот надолго), среди них — более длинные колонки.
 */
function orderedMoves(state: AntsState): AntsMove[] {
  return legalMoves(state)
    .map(column => {
      const top = state.columns[column]![0]!;
      const priority = canEat(state, top.color) ? 0 : 1;
      return { column, priority, length: state.columns[column]!.length };
    })
    .sort((a, b) => a.priority - b.priority || b.length - a.length || a.column - b.column)
    .map(entry => entry.column);
}

/**
 * Последовательность ходов до победы или null.
 * null — решения нет ИЛИ не нашли за maxNodes (для генератора это одно и то же: уровень отбрасываем).
 */
export function solve(state: AntsState, options: SearchOptions = {}): AntsMove[] | null {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const dead = new Set<string>();
  const path: AntsMove[] = [];
  let nodes = 0;

  const search = (current: AntsState): boolean => {
    if (isWon(current)) {
      return true;
    }
    if (nodes++ >= maxNodes) {
      return false;
    }
    const key = stateKey(current);
    if (dead.has(key)) {
      return false;
    }
    for (const move of orderedMoves(current)) {
      const next = applyMove(current, move);
      if (!next) {
        continue;
      }
      path.push(move);
      if (search(next)) {
        return true;
      }
      path.pop();
    }
    // помечаем тупиковым, только если перебор не оборвал лимит
    if (nodes < maxNodes) {
      dead.add(key);
    }
    return false;
  };

  return search(state) ? path : null;
}

/** Следующий ход решателя или null (уже победа, тупик или не нашли). */
export function hint(state: AntsState, options: SearchOptions = {}): AntsMove | null {
  return solve(state, options)?.[0] ?? null;
}

/**
 * Можно ли из этого состояния хоть каким-то путём попасть в тупик.
 * Полный перебор достижимых состояний; превысили лимит — отвечаем true
 * (осторожно: для «безопасных» уровней лучше отбросить лишний, чем пропустить тупик).
 */
export function canGetStuck(state: AntsState, options: SearchOptions = {}): boolean {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const seen = new Set<string>();
  const stack: AntsState[] = [state];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const key = stateKey(current);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (seen.size > maxNodes) {
      return true;
    }
    if (isStuck(current)) {
      return true;
    }
    for (const move of legalMoves(current)) {
      const next = applyMove(current, move);
      if (next) {
        stack.push(next);
      }
    }
  }
  return false;
}

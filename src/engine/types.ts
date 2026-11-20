// Контракт игры: всё, что оболочка знает об игре. Игры подключаются одинаково —
// модуль в src/games/<id>/index.ts и строка в src/games/registry.ts.
import type { ComponentType } from 'react';

/** Что экран игры получает от оболочки. Сессию, Undo и награду ведёт оболочка. */
export interface GameScreenProps<State, Move> {
  /** Текущий снимок уровня. */
  readonly state: State;
  /** Стартовый снимок уровня (например, показать картинку целиком на победе). */
  readonly start: State;
  readonly won: boolean;
  /** Тупик: к победе не пройти — экран пульсирует Undo. */
  readonly stuck: boolean;
  readonly canUndo: boolean;
  /** Сделать ход. false — ход невозможен (экран сам показывает «нельзя»). */
  readonly onMove: (move: Move) => boolean;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
  /** Экран доиграл свою анимацию победы — оболочка показывает награду и ждёт тапа. */
  readonly onWinShown: () => void;
}

export interface GameModule<State, Move> {
  /** Ключ в прогрессе и реестре: 'ants', 'color-jam'. */
  readonly id: string;
  /** Иконка в меню, без текста. */
  readonly Icon: ComponentType;
  /** С какой сложности начинает новый игрок. */
  readonly startDifficulty: number;
  /** Ниже адаптивная сложность не опускается. */
  readonly minDifficulty: number;
  /** Детерминированно: тот же (difficulty, seed) → тот же уровень. */
  makeLevel(difficulty: number, seed: number): State;
  /** null — ход невозможен; state не мутирует. */
  applyMove(state: State, move: Move): State | null;
  isWon(state: State): boolean;
  /** К победе не пройти → пульсирует Undo. */
  isStuck(state: State): boolean;
  /** Следующий ход решателя или null. */
  hint(state: State): Move | null;
  readonly Screen: ComponentType<GameScreenProps<State, Move>>;
}

/** Правила без экрана — то, что нужно сессии (и тестам без React). */
export type GameRules<State, Move> = Pick<GameModule<State, Move>, 'applyMove' | 'isWon' | 'isStuck'>;

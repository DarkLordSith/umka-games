// Контракт игры: всё, что оболочка знает об игре. Игры подключаются одинаково —
// модуль в src/games/<id>/index.ts и строка в src/games/registry.ts.
import type { ComponentType } from 'react';
import type { CollectionRules } from './collection';

/**
 * Что экран игры получает от оболочки. Сессию, Undo, «заново», выход и награду ведёт
 * оболочка (её кнопки — внизу экрана, в зоне --chrome-bottom, которую игра оставляет пустой).
 */
export interface GameScreenProps<State, Move> {
  /** Текущий снимок уровня. */
  readonly state: State;
  /** Стартовый снимок уровня (например, показать картинку целиком на победе). */
  readonly start: State;
  readonly won: boolean;
  /** Подсказка: экран показывает рукой (ui/HintHand), что нажать для этого хода. null — нет. */
  readonly hint: Move | null;
  /** Сделать ход. false — ход невозможен (экран сам показывает «нельзя»). */
  readonly onMove: (move: Move) => boolean;
  /** Экран доиграл свою анимацию победы — оболочка показывает награду и ждёт тапа. */
  readonly onWinShown: () => void;
}

/**
 * Параметры уровня: по ним игра детерминированно строит уровень. Хранятся в прогрессе
 * (пройденные уровни), поэтому переигровка даёт тот же самый уровень.
 */
export interface LevelSpec {
  readonly difficulty: number;
  readonly seed: number;
  /**
   * Вариант контента, выбранный «мешком без повторов» (у муравьёв — id картинки).
   * Хранится явно, чтобы новые картинки не меняли пройденные уровни. null — у игры
   * вариантов нет (или вариант пропал из игры: тогда игра выбирает сама по seed).
   */
  readonly variant: string | null;
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
  /** Детерминированно: тот же LevelSpec → тот же уровень. */
  makeLevel(level: LevelSpec): State;
  /**
   * Вариант следующего уровня (у муравьёв — картинка) по сложности, seed и вариантам
   * уже пройденных уровней по порядку: «мешок без повторов» (engine/levels.ts).
   * Нет у игры — у уровней variant = null.
   */
  nextVariant?(difficulty: number, seed: number, played: readonly (string | null)[]): string | null;
  /** Маленькая картинка уровня для карты. Нет — кружок без превью. */
  readonly Thumbnail?: ComponentType<{ readonly level: LevelSpec }>;
  /** Наклейки для альбома. Нет — игра в альбоме не показывается. */
  readonly album?: GameAlbum;
  /** null — ход невозможен; state не мутирует. */
  applyMove(state: State, move: Move): State | null;
  isWon(state: State): boolean;
  /** К победе не пройти → пульсирует Undo. */
  isStuck(state: State): boolean;
  /** Следующий ход решателя или null. */
  hint(state: State): Move | null;
  readonly Screen: ComponentType<GameScreenProps<State, Move>>;
}

/**
 * Альбом игры: места по всем вариантам (variants), вариант пройденного уровня (variantOf)
 * и картинка наклейки. Белую обводку, тень и блеск рисует оболочка (rewards/) — Art рисует
 * только саму картинку на прозрачном фоне, вписанную в контейнер.
 */
export interface GameAlbum extends CollectionRules {
  /** silhouette — несобранная: форма картинки одним серым цветом (--silhouette). */
  readonly Art: ComponentType<{ readonly variant: string; readonly silhouette?: boolean }>;
}

/** Правила без экрана — то, что нужно сессии (и тестам без React). */
export type GameRules<State, Move> = Pick<GameModule<State, Move>, 'applyMove' | 'isWon' | 'isStuck'>;

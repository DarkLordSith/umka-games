// Коллекция наклеек игры. Отдельно не хранится — выводится из пройденных уровней
// (одно место правды): наклейка = вариант уровня (у муравьёв — картинка),
// «сколько раз собрана» = сколько пройденных уровней с этим вариантом.
import type { LevelSpec } from './types';

/** Что игра даёт альбому, без React: все варианты и вариант пройденного уровня. */
export interface CollectionRules {
  /** Все варианты игры в стабильном порядке — места в альбоме. */
  readonly variants: readonly string[];
  /** Вариант, который уровень на самом деле показал (у старых записей вариант мог пропасть). */
  variantOf(level: LevelSpec): string | null;
}

/** Вариант → сколько раз пройден. Только варианты из rules.variants. */
export function collectionCounts(rules: CollectionRules, levels: readonly LevelSpec[]): ReadonlyMap<string, number> {
  const known = new Set(rules.variants);
  const counts = new Map<string, number>();
  for (const level of levels) {
    const variant = rules.variantOf(level);
    if (variant !== null && known.has(variant)) {
      counts.set(variant, (counts.get(variant) ?? 0) + 1);
    }
  }
  return counts;
}

/** Награда за пройденный уровень: какая наклейка и новая ли она. */
export interface StickerReward {
  readonly variant: string;
  /** Раньше этой наклейки не было — в альбоме новое место. Иначе — повтор, наклейка «прокачивается». */
  readonly isNew: boolean;
}

/**
 * Наклейка за уровень level. before — пройденные уровни до этой победы
 * (у переигровки уровень уже среди них — значит, повтор). null — у уровня нет наклейки.
 */
export function stickerReward(rules: CollectionRules, before: readonly LevelSpec[], level: LevelSpec): StickerReward | null {
  const variant = rules.variantOf(level);
  if (variant === null || !rules.variants.includes(variant)) {
    return null;
  }
  return { variant, isNew: !collectionCounts(rules, before).has(variant) };
}

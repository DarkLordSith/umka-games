// «Мешок без повторов» для вариантов уровней (у муравьёв — картинки).
// Чистые функции: что ещё не показано в текущем круге, считается по пройденным уровням.

/**
 * Варианты, ещё не показанные в текущем круге. Круг — подряд пройденные уровни,
 * пока не показаны все варианты; потом мешок наполняется снова. Только что
 * пройденный вариант первым в новом круге не идёт. Новые варианты (добавили
 * картинки) просто попадают в мешок; пропавшие из игры — не учитываются.
 */
export function bagRemaining(all: readonly string[], played: readonly (string | null)[]): string[] {
  const known = new Set(all);
  const shown = new Set<string>();
  for (const variant of played) {
    if (variant !== null && known.has(variant)) {
      shown.add(variant);
      if (shown.size === known.size) {
        shown.clear();
      }
    }
  }
  const remaining = all.filter(variant => !shown.has(variant));
  const last = [...played].reverse().find(variant => variant !== null && known.has(variant));
  return remaining.length > 1 ? remaining.filter(variant => variant !== last) : remaining;
}

// Иконки кнопок — SVG без текста, цвет берут из currentColor.

/** Undo: стрелка назад по дуге. */
export function UndoIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <path
        d="M18 12 L8 21 L18 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 21 H28 a10 10 0 0 1 0 20 H20" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** «Заново»: круговая стрелка. */
export function RestartIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <path d="M38 24 A14 14 0 1 1 33.9 14.1" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M35 5 V15 H25" fill="none" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Домик — выход в меню (долгим нажатием). */
export function HomeIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <path
        d="M8 23 L24 9 L40 23 M13 19 V39 H35 V19"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 39 V29 H28 V39" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

/** Альбом наклеек: книжка со звёздочкой. */
export function AlbumIcon() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <rect x="18" y="14" width="84" height="94" rx="16" fill="var(--game-blue)" stroke="var(--ink)" strokeWidth="5" />
      <rect x="18" y="14" width="18" height="94" rx="8" fill="var(--game-purple)" stroke="var(--ink)" strokeWidth="5" />
      <path
        d="M69 36 L74.6 48.2 L87.8 49.6 L77.9 58.5 L80.7 71.6 L69 64.9 L57.3 71.6 L60.1 58.5 L50.2 49.6 L63.4 48.2 Z"
        fill="var(--game-yellow)"
        stroke="var(--ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="48" y="82" width="42" height="9" rx="4.5" fill="var(--white)" opacity="0.6" />
    </svg>
  );
}

/** Замок родительского экрана. */
export function LockIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <rect x="10" y="21" width="28" height="21" rx="5" fill="currentColor" />
      <path d="M16 21 V15 a8 8 0 0 1 16 0 V21" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

/** «Дальше» после победы: толстый скруглённый треугольник ▶. */
export function NextIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <path d="M16 9 L39 24 L16 39 Z" fill="currentColor" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}

/** Замочек на закрытой точке карты. */
export function SmallLockIcon() {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <rect x="11" y="21" width="26" height="20" rx="5" fill="currentColor" />
      <path d="M17 21 V16 a7 7 0 0 1 14 0 V21" fill="none" stroke="currentColor" strokeWidth="5" />
    </svg>
  );
}

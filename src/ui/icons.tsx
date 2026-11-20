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

// Иконка муравьёв в меню: мордочка муравья на пиксельном «пироге». Без текста.
export function AntsIcon() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      <rect x="6" y="6" width="108" height="108" rx="30" fill="var(--panel)" />
      {/* пиксели картинки */}
      <rect x="18" y="70" width="18" height="18" rx="4" fill="var(--game-red)" />
      <rect x="38" y="70" width="18" height="18" rx="4" fill="var(--game-red)" />
      <rect x="18" y="90" width="18" height="18" rx="4" fill="var(--game-orange)" />
      <rect x="84" y="90" width="18" height="18" rx="4" fill="var(--game-green)" />
      {/* муравей: брюшко, голова, глаза, усики */}
      <g stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round">
        <path d="M70 52 L60 40 M80 50 L84 36" fill="none" />
        <path d="M58 76 L48 84 M66 80 L62 94 M78 80 L84 94 M86 74 L98 82" fill="none" />
      </g>
      <circle cx="60" cy="40" r="4" fill="var(--ink)" />
      <circle cx="84" cy="36" r="4" fill="var(--ink)" />
      <ellipse cx="72" cy="88" rx="17" ry="14" fill="var(--game-purple)" stroke="var(--ink)" strokeWidth="3.5" />
      <circle cx="72" cy="64" r="17" fill="var(--game-purple)" stroke="var(--ink)" strokeWidth="3.5" />
      <circle cx="65" cy="62" r="6.5" fill="var(--white)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx="79" cy="62" r="6.5" fill="var(--white)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx="66" cy="63" r="3.4" fill="var(--ink)" />
      <circle cx="80" cy="63" r="3.4" fill="var(--ink)" />
    </svg>
  );
}

// Единственный источник цветов приложения. Цветовой литерал в любом другом
// файле src/, index.html или vite.config.ts — ошибка теста (tests/palette.test.ts).
// Файл без импортов: его читают и браузер, и vite.config.ts, и scripts/icons.ts.

/**
 * Игровые цвета — 8 «конфетных» + чёрный (контур картинок с 4-го уровня, глаза, колёса).
 * Больше не добавлять: хуже различаются.
 * id совпадают с фразами озвучки `color-<id>` из docs/VOICE.md.
 * Порядок важен: в уровнях цвет хранится индексом в этом массиве — новые только в конец.
 */
export const GAME_COLORS = [
  { id: 'red', hex: '#f2334b' },
  { id: 'orange', hex: '#ff8c1a' },
  { id: 'yellow', hex: '#ffd21f' },
  { id: 'green', hex: '#2fc25a' },
  { id: 'lightblue', hex: '#4fd6f7' },
  { id: 'blue', hex: '#2a75ff' },
  { id: 'purple', hex: '#8b2fd9' },
  { id: 'pink', hex: '#ff7cc8' },
  /** тёплый тёмный, как контур блоков (ink), а не чистый #000 */
  { id: 'black', hex: '#2b1f30' },
] as const;

/** Индекс чёрного в GAME_COLORS. */
export const BLACK = GAME_COLORS.findIndex(color => color.id === 'black');

export type GameColorId = (typeof GAME_COLORS)[number]['id'];

/** Цвета оболочки: фон, текст-цифры, обводки, тени. В игровые не входят. */
export const UI_COLORS = {
  /** фон страницы — тёплый «сливочный» */
  bg: '#fff3dc',
  /** подложки: поле, полоса слотов */
  panel: '#ffe1b3',
  /** верхняя полоса под статус-баром iOS: только фон, белые часы на ней читаются */
  sky: '#6a55d8',
  /** цифры и контуры */
  ink: '#3b2348',
  white: '#ffffff',
  /** несобранная наклейка в альбоме — тёплый серый силуэт */
  silhouette: '#d6c8bd',
} as const;

/** Тень — цвет ink с прозрачностью. */
export const SHADOW = 'rgba(59, 35, 72, 0.22)';

/** Фон с нулевой прозрачностью — начало градиента к фону (просто transparent в Safari даёт серую полосу). */
export const BG_CLEAR = 'rgba(255, 243, 220, 0)';

/** Цвет статус-бара Android/Chrome и фон splash-экрана PWA. */
export const THEME_COLOR = UI_COLORS.bg;

/** CSS-переменные: --bg, --panel, …, --game-red, …, --shadow. */
export const CSS_TOKENS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(UI_COLORS).map(([name, hex]) => [`--${name}`, hex])),
  ...Object.fromEntries(GAME_COLORS.map(({ id, hex }) => [`--game-${id}`, hex])),
  '--shadow': SHADOW,
  '--bg-clear': BG_CLEAR,
};

/** `:root { --bg: …; }` — vite.config.ts вставляет это правило прямо в index.html. */
export function cssRootRule(): string {
  const lines = Object.entries(CSS_TOKENS).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${lines.join('\n')}\n}`;
}

// Один источник цветов — src/ui/palette.ts. Тест падает на цветовом литерале в любом другом файле.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSS_TOKENS, cssRootRule, GAME_COLORS, THEME_COLOR, UI_COLORS } from '../src/ui/palette';

const ROOT = join(import.meta.dirname, '..');

/** Файлы, где разрешены литералы цвета. Список короткий и явный. */
const ALLOWED = ['src/ui/palette.ts'];

/** #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(). */
const COLOR_LITERAL = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?)\(/gi;

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Исходники приложения — новые файлы подхватываются сами. */
const SOURCES = [...walk('src'), ...walk('scripts'), 'index.html', 'vite.config.ts']
  .filter(file => /\.(tsx?|css|html)$/.test(file))
  .map(file => relative(ROOT, join(ROOT, file)));

describe('цветовые литералы', () => {
  it('тест видит исходники', () => {
    expect(SOURCES).toEqual(expect.arrayContaining(['src/ui/palette.ts', 'src/app/base.css', 'src/main.tsx', 'index.html']));
  });

  it('есть только в src/ui/palette.ts', () => {
    const offenders = SOURCES.filter(file => !ALLOWED.includes(file)).flatMap(file =>
      readFileSync(join(ROOT, file), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          [...line.matchAll(COLOR_LITERAL)].map(match => `${file}:${index + 1}: ${match[0]}  ←  ${line.trim()}`),
        ),
    );
    expect(offenders, 'перенеси цвета в src/ui/palette.ts').toEqual([]);
  });

  it('проверка ловит все формы литералов', () => {
    const samples = ["'#fff'", "'#0f1220'", "'#0f1220cc'", 'rgba(0,0,0,.5)', 'rgb(1 2 3)', 'hsl(10 20% 30%)'];
    expect(samples.every(sample => sample.match(COLOR_LITERAL))).toBe(true);
    expect('#root #app #stage'.match(COLOR_LITERAL)).toBeNull();
  });
});

// --- различимость: CIE Lab и ΔE76 ---

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Порог «явно разные цвета» с запасом: ΔE ≈ 2 — заметно глазу, 25+ — разные цвета. */
const MIN_DELTA_E = 30;

describe('игровые цвета', () => {
  it('8 цветов + чёрный, id и значения уникальны', () => {
    expect(GAME_COLORS.length).toBeLessThanOrEqual(9);
    expect(GAME_COLORS.filter(color => color.id !== 'black').length).toBeLessThanOrEqual(8);
    expect(GAME_COLORS.map(color => color.id)).toContain('black');
    expect(new Set(GAME_COLORS.map(color => color.id)).size).toBe(GAME_COLORS.length);
    expect(new Set(GAME_COLORS.map(color => color.hex.toLowerCase())).size).toBe(GAME_COLORS.length);
  });

  it('хорошо различимы между собой', () => {
    const close: string[] = [];
    for (const [i, a] of GAME_COLORS.entries()) {
      for (const b of GAME_COLORS.slice(i + 1)) {
        const distance = deltaE(a.hex, b.hex);
        if (distance < MIN_DELTA_E) {
          close.push(`${a.id}–${b.id}: ΔE ${distance.toFixed(1)}`);
        }
      }
    }
    expect(close).toEqual([]);
  });

  it('видны на фоне страницы и подложки', () => {
    const weak = GAME_COLORS.flatMap(({ id, hex }) =>
      [UI_COLORS.bg, UI_COLORS.panel]
        .filter(background => deltaE(hex, background) < MIN_DELTA_E)
        .map(background => `${id} на ${background}`),
    );
    expect(weak).toEqual([]);
  });

  it('у каждого цвета есть фраза color-<id> в docs/VOICE.md', () => {
    const voice = readFileSync(join(ROOT, 'docs/VOICE.md'), 'utf8');
    const phrases = [...voice.matchAll(/`color-([a-z]+)`/g)].map(match => match[1]);
    expect(GAME_COLORS.map(color => color.id).sort()).toEqual([...phrases].sort());
  });
});

describe('CSS-переменные', () => {
  it('правило :root содержит все токены', () => {
    const rule = cssRootRule();
    expect(rule.startsWith(':root {')).toBe(true);
    expect(rule).toContain(`--bg: ${UI_COLORS.bg};`);
    expect(rule).toContain(`--game-red: ${GAME_COLORS[0].hex};`);
  });

  it('каждый var(--x) из исходников определён', () => {
    const definedInCss = SOURCES.filter(file => file.endsWith('.css')).flatMap(file =>
      [...readFileSync(join(ROOT, file), 'utf8').matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]),
    );
    const defined = new Set([...Object.keys(CSS_TOKENS), ...definedInCss]);
    // var(--x, запасное) может задаваться в style из кода; var(--x) без запасного обязан быть определён.
    // var(--game-${id}) собирается в коде — проверяем отдельно через CSS_TOKENS
    const missing = SOURCES.flatMap(file =>
      [...readFileSync(join(ROOT, file), 'utf8').matchAll(/var\((--[\w-]+)\s*\)/g)]
        .map(match => match[1]!)
        .filter(name => !defined.has(name))
        .map(name => `${file}: ${name}`),
    );
    expect(missing).toEqual([]);
    expect(GAME_COLORS.every(({ id }) => `--game-${id}` in CSS_TOKENS)).toBe(true);
  });

  it('цвет темы — фон страницы', () => {
    expect(THEME_COLOR).toBe(UI_COLORS.bg);
  });
});

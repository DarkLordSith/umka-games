import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { cssRootRule, THEME_COLOR } from './src/ui/palette.ts';

// GitHub Pages: https://darklordsith.github.io/umka-games/
const BASE = '/umka-games/';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Короткий хеш коммита сборки (для родительского экрана). Без git — GITHUB_SHA или "dev". */
function commitHash(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';
  }
}

/**
 * Цвета живут только в src/ui/palette.ts. Плагин вставляет их в index.html
 * как `<style>:root{…}</style>` и `<meta name="theme-color">`: переменные есть
 * до первого кадра (без вспышки чужого фона) и попадают в офлайн-кэш вместе с HTML.
 */
function paletteCss(): Plugin {
  return {
    name: 'umka:palette-css',
    transformIndexHtml() {
      return [
        { tag: 'style', attrs: { id: 'palette' }, children: cssRootRule(), injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: THEME_COLOR }, injectTo: 'head' },
      ];
    },
    // <style> запечён в HTML, HMR его не заменит — после правки палитры перезагрузить страницу.
    hotUpdate({ file }) {
      if (this.environment.name === 'client' && file.endsWith('/src/ui/palette.ts')) {
        this.environment.hot.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },
  plugins: [
    react(),
    paletteCss(),
    VitePWA({
      registerType: 'autoUpdate',
      // регистрируем сами в main.tsx (registerSW), чтобы добавить проверку при возврате на экран
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Умка',
        short_name: 'Умка',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: THEME_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,svg,webmanifest,m4a}'],
        cleanupOutdatedCaches: true,
        // Без них новый worker ждёт, пока закроют все окна, а iOS держит PWA в памяти днями.
        // С ними новая сборка встаёт сразу, а registerSW в main.tsx перезагружает страницу.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

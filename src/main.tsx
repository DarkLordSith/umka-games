import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { blockIosZoom } from './app/ios';
import './app/base.css';

blockIosZoom();

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root не найден в index.html');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker (vite-plugin-pwa, autoUpdate + skipWaiting + clientsClaim):
// новая сборка встаёт сразу, registerSW перезагружает страницу на неё.
// PWA, вернувшаяся из фона, не делает навигацию — поэтому проверяем обновление
// каждый раз, когда приложение снова на экране.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) {
      return;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void registration.update().catch(() => {});
      }
    });
  },
});

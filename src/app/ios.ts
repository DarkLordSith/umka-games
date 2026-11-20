/**
 * iOS-защиты, которые не задаются CSS: жест щипка (gesture*) и двойной тап.
 * touch-action: none в base.css уже гасит зум в Safari; это — подстраховка
 * для старых iOS и для элементов, где touch-action переопределят.
 */
export function blockIosZoom(): void {
  const prevent = (event: Event) => event.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) {
    document.addEventListener(type, prevent, { passive: false });
  }
  // щипок двумя пальцами в Safari без gesture-событий
  document.addEventListener(
    'touchmove',
    event => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

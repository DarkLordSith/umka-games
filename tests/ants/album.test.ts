import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { collectionCounts } from '../../src/engine/collection';
import { migrate } from '../../src/engine/progress';
import { antsGame } from '../../src/games/ants';
import { pictureCells } from '../../src/games/ants/PictureCanvas';
import { PICTURES } from '../../src/games/ants/pictures';
import { UI_COLORS } from '../../src/ui/palette';

const album = antsGame.album!;

describe('альбом муравьёв', () => {
  it('место на каждую картинку, порядок стабильный, без повторов', () => {
    expect(album.variants).toEqual(PICTURES.map(picture => picture.id));
    expect(new Set(album.variants).size).toBe(PICTURES.length);
  });

  it('каждая картинка рисуется как наклейка и как серый силуэт той же формы', () => {
    for (const picture of PICTURES) {
      const colored = pictureCells(picture);
      const silhouette = pictureCells(picture, true);
      expect(colored.length, picture.id).toBeGreaterThan(0);
      expect(silhouette.map(({ x, y }) => [x, y]), picture.id).toEqual(colored.map(({ x, y }) => [x, y]));
      expect(new Set(silhouette.map(cell => cell.fill)), picture.id).toEqual(new Set([UI_COLORS.silhouette]));
      expect(colored.some(cell => cell.fill !== UI_COLORS.silhouette), picture.id).toBe(true);
      for (const silhouetteFlag of [false, true]) {
        const html = renderToStaticMarkup(createElement(album.Art, { variant: picture.id, silhouette: silhouetteFlag }));
        expect(html, picture.id).toContain('<canvas');
      }
    }
  });

  it('вариант уровня — картинка, которую он показал (и у пропавших из игры картинок)', () => {
    expect(album.variantOf({ difficulty: 5, seed: 3, variant: 'cake' })).toBe('cake');
    const fallback = album.variantOf({ difficulty: 5, seed: 3, variant: 'нет-такой' });
    expect(album.variants).toContain(fallback);
  });

  it('после обновления альбом старого игрока собирается из пройденных уровней', () => {
    const progress = migrate({
      v: 5,
      games: {
        ants: {
          difficulty: 9,
          streak: 0,
          seed: 4,
          levels: [
            { difficulty: 8, seed: 1, variant: 'cake' },
            { difficulty: 9, seed: 2, variant: 'frog' },
            { difficulty: 9, seed: 3, variant: 'cake' },
          ],
        },
      },
      stickers: [0, 1, 2],
      settings: { sfx: true, voice: true, music: true },
    });
    const counts = collectionCounts(album, progress.games.ants!.levels);
    expect(Object.fromEntries(counts)).toEqual({ cake: 2, frog: 1 });
  });
});

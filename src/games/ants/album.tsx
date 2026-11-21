// Альбом муравьёв: место на каждую картинку (порядок — как в PICTURES), наклейка — сама картинка.
import type { GameAlbum } from '../../engine/types';
import { PICTURE_IDS, pictureFor } from './generator';
import { PictureCanvas } from './PictureCanvas';
import { PICTURES } from './pictures';

export const antsAlbum: GameAlbum = {
  variants: PICTURE_IDS,
  // картинка, которую уровень показал на самом деле (вариант мог пропасть — тогда выбор по seed)
  variantOf: level => pictureFor(level).id,
  Art: ({ variant, silhouette }) => {
    const picture = PICTURES.find(item => item.id === variant);
    return picture ? <PictureCanvas picture={picture} silhouette={silhouette} /> : null;
  },
};

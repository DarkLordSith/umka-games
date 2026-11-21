// Превью уровня для карты: картинка, которую съедят (съели) муравьи, — без обводки, так красивее.
import type { LevelSpec } from '../../engine/types';
import { pictureFor } from './generator';
import { PictureCanvas } from './PictureCanvas';

export function AntsThumbnail({ level }: { readonly level: LevelSpec }) {
  return <PictureCanvas picture={pictureFor(level)} />;
}

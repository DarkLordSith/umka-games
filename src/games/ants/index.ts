// Муравьи — модуль игры по контракту (src/engine/types.ts).
import type { GameModule } from '../../engine/types';
import { levelFromSpec, nextPicture } from './generator';
import { AntsIcon } from './Icon';
import { type AntsMove, type AntsState, applyMove, isStuck, isWon } from './logic';
import { AntsScreen } from './Screen';
import { AntsThumbnail } from './Thumbnail';
import { hint } from './solver';

export const antsGame: GameModule<AntsState, AntsMove> = {
  id: 'ants',
  Icon: AntsIcon,
  // первые уровни кривой — «без тупика»; дальше адаптивная сложность (engine/difficulty)
  startDifficulty: 1,
  minDifficulty: 1,
  makeLevel: levelFromSpec,
  nextVariant: nextPicture,
  Thumbnail: AntsThumbnail,
  applyMove,
  isWon,
  isStuck,
  hint: state => hint(state),
  Screen: AntsScreen,
};

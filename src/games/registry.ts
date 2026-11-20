// Игры в меню — по порядку. Новая игра = модуль в src/games/<id>/ и строка здесь.
import type { GameModule } from '../engine/types';
import { antsGame } from './ants';

// GameModule<State, Move> у каждой игры свой; оболочке важен только контракт.
export type AnyGame = GameModule<any, any>;

export const GAMES: readonly AnyGame[] = [antsGame];

export function findGame(id: string): AnyGame | undefined {
  return GAMES.find(game => game.id === id);
}

import { describe, expect, it } from 'vitest';
import { levelResult, sessionMove, sessionState, startSession } from '../../src/engine/session';
import { antsGame } from '../../src/games/ants';
import { pictureIndex } from '../../src/games/ants/generator';
import { PICTURES } from '../../src/games/ants/pictures';
import { findGame, GAMES } from '../../src/games/registry';

describe('муравьи по контракту', () => {
  it('в реестре, id уникальны', () => {
    expect(findGame('ants')).toBe(antsGame);
    expect(new Set(GAMES.map(game => game.id)).size).toBe(GAMES.length);
  });

  it('стартовый уровень проходится по подсказкам через сессию — чистая победа', () => {
    let session = startSession(antsGame.makeLevel(antsGame.startDifficulty, 1));
    for (let guard = 0; guard < 200 && !antsGame.isWon(sessionState(session)); guard++) {
      const move = antsGame.hint(sessionState(session));
      expect(move).not.toBeNull();
      session = sessionMove(antsGame, session, move!)!;
    }
    expect(antsGame.isWon(sessionState(session))).toBe(true);
    expect(levelResult(session).clean).toBe(true);
  });

  it('картинка — по seed: подряд идущие seed дают разные картинки по кругу', () => {
    const ids = Array.from({ length: PICTURES.length }, (_, index) => pictureIndex(index + 1));
    expect(new Set(ids).size).toBe(PICTURES.length);
    expect(pictureIndex(PICTURES.length + 1)).toBe(pictureIndex(1));
  });
});

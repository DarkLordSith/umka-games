// Меню: крупные иконки игр (без текста), альбом наклеек, вход для родителей.
// Верхние ~80 pt — только фон (в PWA iOS там размыто).
import { GAMES } from '../games/registry';
import { AlbumIcon, LockIcon } from '../ui/icons';
import { LongPress } from '../ui/LongPress';
import './menu.css';

/** Вход в родительский экран: держать замок столько. */
export const PARENT_HOLD_MS = 3_000;

export interface MenuProps {
  readonly onPlay: (gameId: string) => void;
  readonly onAlbum: () => void;
  readonly onParent: () => void;
}

export function Menu({ onPlay, onAlbum, onParent }: MenuProps) {
  return (
    <div className="menu">
      <div className="sky" aria-hidden="true" />
      <main className="menu-games">
        {GAMES.map(game => (
          <button key={game.id} type="button" className="menu-game" aria-label={game.id} onClick={() => onPlay(game.id)}>
            <game.Icon />
          </button>
        ))}
      </main>
      <div className="menu-bottom">
        <button type="button" className="menu-album" aria-label="альбом" onClick={onAlbum}>
          <AlbumIcon />
        </button>
        <LongPress className="menu-parent" duration={PARENT_HOLD_MS} onComplete={onParent} label="для родителей">
          <LockIcon />
        </LongPress>
      </div>
    </div>
  );
}

// Родительский экран (за замком: 3 с держать в углу меню). Здесь — и только здесь — можно текст.
import { useState } from 'react';
import { gameProgress, type Progress, withoutGame, withSettings } from '../engine/progress';
import { type AnyGame, GAMES } from '../games/registry';
import { Modal } from '../ui/Modal';
import './parent.css';

export interface ParentScreenProps {
  readonly progress: Progress;
  readonly onProgress: (progress: Progress) => void;
  readonly onBack: () => void;
}

export function ParentScreen({ progress, onProgress, onBack }: ParentScreenProps) {
  const [resetting, setResetting] = useState<AnyGame | null>(null);
  const { sfx, voice } = progress.settings;

  return (
    <div className="parent">
      <div className="sky" aria-hidden="true" />
      <div className="parent-body">
        <h1>Для родителей</h1>

        <section className="parent-card">
          <h2>Звук</h2>
          <label className="parent-switch">
            <span>Звуки игры</span>
            <input type="checkbox" checked={sfx} onChange={() => onProgress(withSettings(progress, { sfx: !sfx }))} />
          </label>
          <label className="parent-switch">
            <span>Голос</span>
            <input type="checkbox" checked={voice} onChange={() => onProgress(withSettings(progress, { voice: !voice }))} />
          </label>
        </section>

        <section className="parent-card">
          <h2>Прогресс</h2>
          {GAMES.map(game => {
            const saved = gameProgress(progress, game.id, game.startDifficulty);
            return (
              <div key={game.id} className="parent-game">
                <span className="parent-game-icon">
                  <game.Icon />
                </span>
                <span className="parent-game-stats">
                  Пройдено уровней: {saved.won}
                  <br />
                  Сложность: {saved.difficulty}
                </span>
                <button type="button" className="parent-button is-danger" onClick={() => setResetting(game)}>
                  Сбросить
                </button>
              </div>
            );
          })}
        </section>

        <p className="parent-version">
          Версия {__APP_VERSION__} · коммит {__COMMIT_HASH__}
        </p>

        <button type="button" className="parent-button is-wide" onClick={onBack}>
          Назад к играм
        </button>
      </div>

      {resetting ? (
        <Modal
          onClose={() => setResetting(null)}
          actions={
            <>
              <button type="button" className="parent-button" onClick={() => setResetting(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="parent-button is-danger"
                onClick={() => {
                  onProgress(withoutGame(progress, resetting.id));
                  setResetting(null);
                }}
              >
                Сбросить
              </button>
            </>
          }
        >
          Сбросить прогресс этой игры? Она начнётся заново с первого уровня. Наклейки останутся.
        </Modal>
      ) : null}
    </div>
  );
}

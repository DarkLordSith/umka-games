import { describe, expect, it } from 'vitest';
import { canUndo, createHistory, current, push, restart, undo } from '../../src/engine/history';

describe('history', () => {
  it('push — новый снимок текущий, старая история не меняется', () => {
    const start = createHistory('a');
    const next = push(start, 'b');
    expect(current(next)).toBe('b');
    expect(current(start)).toBe('a');
  });

  it('undo без ограничений до самого начала', () => {
    let history = createHistory(0);
    for (let i = 1; i <= 10; i++) {
      history = push(history, i);
    }
    while (canUndo(history)) {
      history = undo(history);
    }
    expect(current(history)).toBe(0);
    expect(undo(history)).toBe(history);
  });

  it('restart — только стартовый снимок', () => {
    const history = restart(push(push(createHistory('s'), 'x'), 'y'));
    expect(history.snapshots).toEqual(['s']);
    expect(canUndo(history)).toBe(false);
  });
});

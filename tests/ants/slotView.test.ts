import { describe, expect, it } from 'vitest';
import { antHome, antLeft, placeBlock, viewFromSlots } from '../../src/games/ants/slotView';

const empty = viewFromSlots([null, null, null, null, null], []);

describe('вид слотов', () => {
  it('число уменьшается при выходе муравья, слот пустеет после возвращения последнего', () => {
    let view = placeBlock(empty, 1, 7, 3, 2);
    view = antLeft(view, 1, 7);
    expect(view[1]).toEqual({ tag: 7, color: 3, left: 1, out: 1 });
    view = antLeft(view, 1, 7);
    view = antHome(view, 1, 7);
    expect(view[1]).toEqual({ tag: 7, color: 3, left: 0, out: 1 }); // один ещё бежит — блок виден
    view = antHome(view, 1, 7);
    expect(view[1]).toBeNull();
  });

  it('новый блок в том же слоте показывается сразу, хвост старого его не трогает', () => {
    let view = placeBlock(empty, 0, 1, 2, 1);
    view = antLeft(view, 0, 1);
    view = placeBlock(view, 0, 2, 5, 3);
    view = antHome(view, 0, 1); // старый муравей вернулся
    view = antLeft(view, 0, 1); // и поздний старт старого — тоже мимо
    expect(view[0]).toEqual({ tag: 2, color: 5, left: 3, out: 0 });
  });

  it('пока муравьи ждут (нечего есть), блок стоит с полным числом', () => {
    const view = placeBlock(empty, 4, 9, 1, 5);
    expect(antHome(view, 4, 9)[4]).toEqual({ tag: 9, color: 1, left: 5, out: 0 });
  });

  it('вид по логическим слотам — с метками и без муравьёв в пути', () => {
    expect(viewFromSlots([{ color: 1, left: 2 }, null], [4, 0])).toEqual([{ tag: 4, color: 1, left: 2, out: 0 }, null]);
  });
});

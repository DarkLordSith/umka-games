import { describe, expect, it } from 'vitest';
import { bagRemaining } from '../../src/engine/levels';

const ALL = ['a', 'b', 'c', 'd'];

describe('мешок без повторов', () => {
  it('пока не показаны все — показанные не возвращаются', () => {
    expect(bagRemaining(ALL, [])).toEqual(ALL);
    expect(bagRemaining(ALL, ['b', 'd'])).toEqual(['a', 'c']);
  });

  it('круг закончился — мешок полный, но только что пройденный не первым', () => {
    expect(bagRemaining(ALL, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(bagRemaining(ALL, ['a', 'b', 'c', 'd', 'a'])).toEqual(['b', 'c', 'd']);
  });

  it('новые варианты попадают в мешок, пропавшие и null не мешают', () => {
    expect(bagRemaining([...ALL, 'e'], ['a', 'b', 'c', 'd'])).toEqual(['e']);
    expect(bagRemaining(ALL, ['x', null, 'a'])).toEqual(['b', 'c', 'd']);
  });

  it('один вариант — он и идёт', () => {
    expect(bagRemaining(['a'], ['a'])).toEqual(['a']);
  });
});

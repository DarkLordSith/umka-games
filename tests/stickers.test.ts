import { describe, expect, it } from 'vitest';
import { DISTINCT_STICKERS, recolor, STICKER_DESIGNS, stickerAt, VARIANTS } from '../src/rewards/stickers';
import { GAME_COLORS } from '../src/ui/palette';

const COLORS = new Set<string>([...GAME_COLORS.map(color => color.id), 'white', 'ink']);

describe('наклейки', () => {
  it('минимум 60 различимых, id дизайнов уникальны', () => {
    expect(DISTINCT_STICKERS).toBeGreaterThanOrEqual(60);
    expect(new Set(STICKER_DESIGNS.map(design => design.id)).size).toBe(STICKER_DESIGNS.length);
  });

  it('детерминированно: номер → тот же дизайн и вариант', () => {
    expect(stickerAt(41)).toEqual(stickerAt(41));
    expect(stickerAt(0).design.id).toBe(STICKER_DESIGNS[0]!.id);
  });

  it('10 побед → 10 разных картинок; первые DISTINCT — все разные пары (дизайн, вариант)', () => {
    const first10 = Array.from({ length: 10 }, (_, n) => stickerAt(n).design.id);
    expect(new Set(first10).size).toBe(10);
    const pairs = Array.from({ length: DISTINCT_STICKERS }, (_, n) => {
      const { design, variant } = stickerAt(n);
      return `${design.id}:${variant}`;
    });
    expect(new Set(pairs).size).toBe(DISTINCT_STICKERS);
  });

  it('вариант меняет раскраску каждого дизайна', () => {
    for (const design of STICKER_DESIGNS) {
      const paint = (variant: number) => design.parts.map(part => recolor(part.color, variant)).join(',');
      const variants = new Set(Array.from({ length: VARIANTS }, (_, variant) => paint(variant)));
      expect(variants.size, design.id).toBe(VARIANTS);
    }
  });

  it('только цвета палитры, белый и ink', () => {
    for (const design of STICKER_DESIGNS) {
      for (const part of design.parts) {
        expect(COLORS.has(part.color), `${design.id}: ${part.color}`).toBe(true);
      }
    }
  });
});

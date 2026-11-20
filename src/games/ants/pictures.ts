// Картинки муравьёв: пиксель-арт 16×16 строками символов. Рисуются кодом, свои.
// '.' — пусто (фон картинки пустой с самого начала). Буквы — цвета из src/ui/palette.ts:
//   R красный  O оранжевый  Y жёлтый  G зелёный  L голубой  B синий  P фиолетовый  K розовый
// Простые сюжеты и крупные однотонные области: ребёнка цепляет процесс поедания, а не детали.
import { GAME_COLORS, type GameColorId } from '../../ui/palette';
import { EMPTY } from './logic';

const LETTERS: Readonly<Record<string, GameColorId>> = {
  R: 'red',
  O: 'orange',
  Y: 'yellow',
  G: 'green',
  L: 'lightblue',
  B: 'blue',
  P: 'purple',
  K: 'pink',
};

export interface PictureSource {
  readonly id: string;
  readonly rows: readonly string[];
}

export interface Picture {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Индекс цвета в GAME_COLORS или EMPTY, построчно. */
  readonly pixels: readonly number[];
}

/** Порядок — по кругу в генераторе: от простых (2–3 цвета, мало внутренних областей) к сложным. */
export const PICTURE_SOURCES: readonly PictureSource[] = [
  {
    id: 'apple',
    rows: [
      '................',
      '.......O..GG....',
      '.......O.GGGG...',
      '.......OGGGG....',
      '...RRRRORRRRR...',
      '..RRRRRRRRRRRR..',
      '.RRRRRRRRRRRRRR.',
      '.RRKKRRRRRRRRRR.',
      '.RRKKRRRRRRRRRR.',
      '.RRRRRRRRRRRRRR.',
      '.RRRRRRRRRRRRRR.',
      '.RRRRRRRRRRRRRR.',
      '..RRRRRRRRRRRR..',
      '..RRRRRRRRRRRR..',
      '...RRRRR.RRRRR..',
      '....RRR...RRR...',
    ],
  },
  {
    id: 'fish',
    rows: [
      '................',
      '................',
      '.......YYY......',
      '......YYYY......',
      '....OOOOOOO...YY',
      '...OOOOOOOOO.YYY',
      '..OOBBOOOOOOOYYY',
      '..OOBBOOOOOOOOYY',
      '..OOOOOOOOOOOOYY',
      '..OOOOOOOOOOOYYY',
      '...OOOOOOOOO.YYY',
      '....OOOOOOO...YY',
      '......YYYY......',
      '.......YY.......',
      '................',
      '................',
    ],
  },
  {
    id: 'sun',
    rows: [
      '.......OO.......',
      '..O....OO....O..',
      '...O........O...',
      '.....YYYYYY.....',
      '....YYYYYYYY....',
      '...YYYYYYYYYY...',
      'OO.YYYYYYYYYY.OO',
      'OO.YYYYYYYYYY.OO',
      '...YYYYYYYYYY...',
      '...YYYYYYYYYY...',
      '....YYYYYYYY....',
      '.....YYYYYY.....',
      '...O........O...',
      '..O....OO....O..',
      '.......OO.......',
      '................',
    ],
  },
  {
    id: 'car',
    rows: [
      '................',
      '................',
      '................',
      '....RRRRRRRR....',
      '...RRLLLRLLLR...',
      '...RLLLLRLLLLR..',
      '..RRRRRRRRRRRRR.',
      '.RRRRRRRRRRRRRRR',
      '.YRRRRRRRRRRRRRR',
      '.RRRRRRRRRRRRRRR',
      '.RRRBBBRRRRBBBRR',
      '...BBBBB..BBBBB.',
      '...BBBBB..BBBBB.',
      '....BBB....BBB..',
      '................',
      '................',
    ],
  },
  {
    id: 'mushroom',
    rows: [
      '................',
      '.....RRRRRR.....',
      '...RRRRRRRRRR...',
      '..RRYYRRRRYYRR..',
      '.RRRYYRRRRYYRRR.',
      '.RRRRRRRRRRRRRR.',
      'RRYYRRRRRRRRYYRR',
      'RRYYRRRYYRRRYYRR',
      'RRRRRRRYYRRRRRRR',
      '....YYYYYYYY....',
      '.....YYYYYY.....',
      '.....YYYYYY.....',
      '.....YYYYYY.....',
      '.....YYYYYY.....',
      '..GGGGGGGGGGGG..',
      '.GGGGGGGGGGGGGG.',
    ],
  },
  {
    id: 'strawberry',
    rows: [
      '.....GG..GG.....',
      '......GGGG......',
      '....GGGGGGGG....',
      '...RRRGGGGRRR...',
      '..RRRRRRRRRRRR..',
      '.RRYRRRRYRRRRYR.',
      '.RRRRRRRRRRRRRR.',
      '.RRRRYRRRRYRRRR.',
      '.RYRRRRRRRRRRRR.',
      '..RRRRRYRRRRYR..',
      '..RRRRRRRRRRRR..',
      '...RRYRRRRYRR...',
      '....RRRRRRRR....',
      '.....RRRYRR.....',
      '......RRRR......',
      '.......RR.......',
    ],
  },
  {
    id: 'cat',
    rows: [
      '................',
      '..O..........O..',
      '..OO........OO..',
      '..OKO......OKO..',
      '..OKKOOOOOOKKO..',
      '..OOOOOOOOOOOO..',
      '.OOOOOOOOOOOOOO.',
      '.OOOGGOOOOGGOOO.',
      '.OOOGGOOOOGGOOO.',
      '.OOOOOOOOOOOOOO.',
      '.OOOOOOKKOOOOOO.',
      '.OOOOOOOOOOOOOO.',
      '..OOOOOOOOOOOO..',
      '...OOOOOOOOOO...',
      '.....OOOOOO.....',
      '................',
    ],
  },
  {
    id: 'house',
    rows: [
      '.......RR.......',
      '......RRRR......',
      '.....RRRRRR.....',
      '....RRRRRRRR....',
      '...RRRRRRRRRR...',
      '..RRRRRRRRRRRR..',
      '.RRRRRRRRRRRRRR.',
      '..YYYYYYYYYYYY..',
      '..YYYYYYYYYYYY..',
      '..YLLLYYYYBBBY..',
      '..YLLLYYYYBBBY..',
      '..YLLLYYYYBBBY..',
      '..YYYYYYYYBBBY..',
      '..YYYYYYYYBBBY..',
      'GGGGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGGGG',
    ],
  },
  {
    id: 'ladybug',
    rows: [
      '................',
      '......BBBB......',
      '.....BBBBBB.....',
      '....BBBBBBBB....',
      '...RRRRBBRRRR...',
      '..RRRRRBBRRRRR..',
      '.RRBBRRBBRRBBRR.',
      '.RRBBRRBBRRBBRR.',
      '.RRRRRRBBRRRRRR.',
      '.RRRRRRBBRRRRRR.',
      '.RRBBRRBBRRBBRR.',
      '.RRBBRRBBRRBBRR.',
      '..RRRRRBBRRRRR..',
      '...RRRRBBRRRR...',
      '.....RRBBRR.....',
      '................',
    ],
  },
  {
    id: 'tree',
    rows: [
      '.......YY.......',
      '......YYYY......',
      '.......GG.......',
      '......GGGG......',
      '.....GGGGGG.....',
      '....GGGGRGGG....',
      '.....GGGGGG.....',
      '....GGGGGGGG....',
      '...GGBGGGGGGG...',
      '..GGGGGGGGRGGG..',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '..GRGGGGGBGGGG..',
      '.GGGGGGGGGGGGGG.',
      '.......OO.......',
      '.......OO.......',
    ],
  },
];

/** Строки символов → картинка. Бросает на неизвестной букве или неровных строках. */
export function parsePicture(source: PictureSource): Picture {
  const width = source.rows[0]?.length ?? 0;
  const pixels: number[] = [];
  for (const [y, row] of source.rows.entries()) {
    if (row.length !== width) {
      throw new Error(`${source.id}: строка ${y} длиной ${row.length}, а не ${width}`);
    }
    for (const char of row) {
      if (char === '.') {
        pixels.push(EMPTY);
        continue;
      }
      const id = LETTERS[char];
      if (!id) {
        throw new Error(`${source.id}: неизвестная буква «${char}»`);
      }
      pixels.push(GAME_COLORS.findIndex(color => color.id === id));
    }
  }
  return { id: source.id, width, height: source.rows.length, pixels };
}

export const PICTURES: readonly Picture[] = PICTURE_SOURCES.map(parsePicture);

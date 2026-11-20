// Фразы озвучки — строго как в docs/VOICE.md (тест сверяет). Файл без импортов:
// его читают и приложение, и скрипты voice:import / voice:placeholder (Node).
// Файл фразы: public/voice/<id>.m4a. Группа — id без «-<номер>» (praise-3 → praise).

export interface Phrase {
  readonly id: string;
  /** Текст: по нему говорит заглушка Milena и по нему владелец записывает свой голос. */
  readonly text: string;
}

export const PHRASES: readonly Phrase[] = [
  { id: 'praise-1', text: 'Молодец!' },
  { id: 'praise-2', text: 'Ура, получилось!' },
  { id: 'praise-3', text: 'Здорово!' },
  { id: 'praise-4', text: 'Ты справился!' },
  { id: 'praise-5', text: 'Вот это да!' },
  { id: 'praise-6', text: 'Супер!' },
  { id: 'praise-7', text: 'Отлично получилось!' },
  { id: 'sticker-new', text: 'Новая наклейка!' },
  { id: 'album-open', text: 'Смотри, сколько наклеек!' },
  { id: 'start-1', text: 'Поехали!' },
  { id: 'stuck-back', text: 'Давай попробуем назад.' },
  { id: 'hint-1', text: 'Посмотри сюда.' },
  { id: 'hint-2', text: 'Попробуй вот так.' },
  { id: 'color-red', text: 'Красный' },
  { id: 'color-blue', text: 'Синий' },
  { id: 'color-yellow', text: 'Жёлтый' },
  { id: 'color-green', text: 'Зелёный' },
  { id: 'color-purple', text: 'Фиолетовый' },
  { id: 'color-orange', text: 'Оранжевый' },
  { id: 'color-pink', text: 'Розовый' },
  { id: 'color-lightblue', text: 'Голубой' },
  { id: 'color-black', text: 'Чёрный' },
  { id: 'ants-go', text: 'Муравьи, вперёд!' },
  { id: 'ants-yum', text: 'Ам-ам-ам!' },
  { id: 'jam-out', text: 'Ушёл!' },
];

/** Группа фразы: praise-3 → praise, hint-1 → hint, stuck-back → stuck-back. */
export function groupOf(id: string): string {
  return id.replace(/-\d+$/, '');
}

/** id фраз группы по порядку. */
export function phrasesOf(group: string): string[] {
  return PHRASES.filter(phrase => groupOf(phrase.id) === group).map(phrase => phrase.id);
}

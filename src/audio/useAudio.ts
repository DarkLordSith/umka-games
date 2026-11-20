// Хук для экранов игр и оболочки: звук и голос — только через него, свой AudioContext
// игра не создаёт (CLAUDE.md → «Контракт игры»).
import { sfx } from './sfx';
import { say, sayColor, sayFrom } from './voice';

const api = { sfx, say, sayFrom, sayColor } as const;

export type AudioApi = typeof api;

export function useAudio(): AudioApi {
  return api;
}

// Один AudioContext на всё приложение. Браузеры (особенно iOS) дают звук только после
// касания: контекст создаётся и «будится» первым касанием, а при возврате на экран
// (iOS приостанавливает звук свёрнутой PWA) — resume.
//
// Три канала: эффекты, голос и музыка. Пока звучит голос, эффекты тише, а музыка — ещё тише.
// Выключатели из родительского экрана (progress.settings) применяет оболочка: setAudioSettings.

export interface AudioSettings {
  readonly sfx: boolean;
  readonly voice: boolean;
  readonly music: boolean;
}

/** Громкость эффектов, пока звучит голос. */
const DUCKED = 0.35;
/** Громкость музыки, пока звучит голос (приглушается сильнее эффектов). */
const MUSIC_DUCKED = 0.2;

let context: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let settings: AudioSettings = { sfx: true, voice: true, music: true };
const listeners = new Set<() => void>();
const settingsListeners = new Set<() => void>();

type ContextClass = typeof AudioContext;

function create(): AudioContext | null {
  const Class: ContextClass | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: ContextClass }).webkitAudioContext;
  if (!Class) {
    return null;
  }
  const created = new Class();
  sfxBus = created.createGain();
  voiceBus = created.createGain();
  musicBus = created.createGain();
  sfxBus.connect(created.destination);
  voiceBus.connect(created.destination);
  musicBus.connect(created.destination);
  return created;
}

/** Разбудить звук. Зовётся из обработчика касания — только там iOS разрешает. */
function unlock(): void {
  if (!context) {
    context = create();
    if (!context) {
      return;
    }
    // iOS: короткий пустой буфер в жесте окончательно открывает вывод звука
    const silent = context.createBuffer(1, 1, 22_050);
    const source = context.createBufferSource();
    source.buffer = silent;
    source.connect(context.destination);
    source.start();
    listeners.forEach(listener => listener());
  }
  if (context.state !== 'running') {
    void context.resume().catch(() => {});
  }
}

/** Подключить разблокировку касанием и resume при возврате на экран. Один раз в main.tsx. */
export function installAudioUnlock(): void {
  // iOS разрешает звук не на всех событиях касания в разных версиях — слушаем несколько
  for (const type of ['pointerdown', 'touchend', 'click']) {
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && context && context.state !== 'running') {
      void context.resume().catch(() => {});
    }
  });
}

/** Контекст, если звук уже разбужен и работает; иначе null — играть нечего. */
export function audioContext(): AudioContext | null {
  return context && context.state === 'running' ? context : null;
}

/** Звук разбужен (один раз) — например, начать подгрузку голоса. */
export function onAudioReady(listener: () => void): void {
  if (context) {
    listener();
  } else {
    listeners.add(listener);
  }
}

/** Настройки поменялись (музыка включается и выключается сама). */
export function onAudioSettings(listener: () => void): void {
  settingsListeners.add(listener);
}

export function setAudioSettings(next: AudioSettings): void {
  const changed = next.sfx !== settings.sfx || next.voice !== settings.voice || next.music !== settings.music;
  settings = next;
  if (changed) {
    settingsListeners.forEach(listener => listener());
  }
  // выключили голос посреди фразы — замолкает сразу
  if (voiceBus && context) {
    voiceBus.gain.setValueAtTime(next.voice ? 1 : 0, context.currentTime);
  }
}

export function audioSettings(): AudioSettings {
  return settings;
}

export function sfxOutput(): GainNode | null {
  return settings.sfx ? sfxBus : null;
}

export function voiceOutput(): GainNode | null {
  return settings.voice ? voiceBus : null;
}

/** Канал музыки (приглушается под голос). Включена ли музыка — решает music.ts по settings. */
export function musicOutput(): GainNode | null {
  return musicBus;
}

function duck(bus: GainNode | null, level: number, seconds: number): void {
  if (!context || !bus) {
    return;
  }
  const now = context.currentTime;
  const gain = bus.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(level, now + 0.08);
  gain.setValueAtTime(level, now + seconds);
  gain.linearRampToValueAtTime(1, now + seconds + 0.35);
}

/** Пока звучит голос (seconds): эффекты тише, музыка — ещё тише. */
export function duckForVoice(seconds: number): void {
  duck(sfxBus, DUCKED, seconds);
  duck(musicBus, MUSIC_DUCKED, seconds);
}

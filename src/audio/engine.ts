// Один AudioContext на всё приложение. Браузеры (особенно iOS) дают звук только после
// касания: контекст создаётся и «будится» первым касанием, а при возврате на экран
// (iOS приостанавливает звук свёрнутой PWA) — resume.
//
// Два канала: эффекты и голос. Пока звучит голос, эффекты тише (duck).
// Выключатели из родительского экрана (progress.settings) применяет оболочка: setAudioSettings.

export interface AudioSettings {
  readonly sfx: boolean;
  readonly voice: boolean;
}

/** Громкость эффектов, пока звучит голос. */
const DUCKED = 0.35;

let context: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let settings: AudioSettings = { sfx: true, voice: true };
const listeners = new Set<() => void>();

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
  sfxBus.connect(created.destination);
  voiceBus.connect(created.destination);
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

export function setAudioSettings(next: AudioSettings): void {
  settings = next;
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

/** Эффекты тише на seconds (пока звучит голос). */
export function duckSfx(seconds: number): void {
  if (!context || !sfxBus) {
    return;
  }
  const now = context.currentTime;
  const gain = sfxBus.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(DUCKED, now + 0.08);
  gain.setValueAtTime(DUCKED, now + seconds);
  gain.linearRampToValueAtTime(1, now + seconds + 0.25);
}

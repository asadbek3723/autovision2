/**
 * Vibratsiya va tovush — tashqi fayllarsiz (WebAudio bilan sintez).
 * iOS'da `navigator.vibrate` yo'q — jimgina o'tkazib yuboriladi.
 */

const MUTE_KEY = 'carvision_capture_muted';

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* noop */
  }
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator) || reducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
}

let audio: AudioContext | null = null;

/** Birinchi foydalanuvchi bosishida chaqiriladi (autoplay siyosati) */
export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    /* noop */
  }
}

function tone(freq: number, durationMs: number, gain = 0.06, type: OscillatorType = 'sine', delayMs = 0) {
  if (!audio || isMuted()) return;
  const t0 = audio.currentTime + delayMs / 1000;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

/** LOCK: yumshoq "tik" */
export function playLock(): void {
  tone(880, 60, 0.05);
  vibrate(12);
}

/** Suratga olish: qisqa shovqin + past ohang */
export function playShutter(): void {
  if (audio && !isMuted()) {
    const len = Math.floor(audio.sampleRate * 0.03);
    const buffer = audio.createBuffer(1, len, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.createBufferSource();
    const g = audio.createGain();
    g.gain.value = 0.12;
    src.buffer = buffer;
    src.connect(g).connect(audio.destination);
    src.start();
    tone(180, 90, 0.05, 'triangle', 10);
  }
  vibrate([18, 40, 18]);
}

export function playError(): void {
  tone(220, 120, 0.05, 'square');
  vibrate([40]);
}

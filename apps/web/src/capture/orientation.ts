import { angleDiff, normalize360, poseFromEuler } from './orientationMath';

/**
 * Telefon sensorlari (giroskop/kompas) — brauzer qatlami.
 * Matematika `orientationMath.ts` da (testlanadi); bu yerda faqat hodisalar,
 * ruxsat va tekislash.
 */

export type SensorPermission = 'granted' | 'denied' | 'unsupported';

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * iOS 13+ da ruxsat FAQAT foydalanuvchi bosishi ichida so'raladi — shuning
 * uchun bu "Boshlash" tugmasi handler'idan chaqirilishi kerak.
 */
export async function requestSensorPermission(): Promise<SensorPermission> {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'unsupported';
  const Ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventStatic;
  if (typeof Ctor.requestPermission === 'function') {
    try {
      return (await Ctor.requestPermission()) === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

export class OrientationTracker {
  private az: number | null = null;
  private pitchValue: number | null = null;
  private lastEvent = 0;
  private listening: 'deviceorientationabsolute' | 'deviceorientation' | null = null;

  private readonly onEvent = (event: Event) => {
    const e = event as DeviceOrientationEvent;
    // Kompyuterda hodisa keladi, lekin qiymatlar null — sensor yo'q hisoblanadi
    if (e.alpha === null || e.beta === null || e.gamma === null) return;

    const pose = poseFromEuler(e.alpha, e.beta, e.gamma);
    // Aylanma tekislash: 0/360 chegarasida sakramasligi uchun burchak farqi orqali
    this.az =
      this.az === null
        ? pose.azimuth
        : normalize360(this.az + angleDiff(pose.azimuth, this.az) * 0.4);
    this.pitchValue =
      this.pitchValue === null ? pose.pitch : this.pitchValue + (pose.pitch - this.pitchValue) * 0.3;
    this.lastEvent = performance.now();
  };

  start(): void {
    if (this.listening || typeof window === 'undefined') return;
    const type =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, this.onEvent, true);
    this.listening = type;
  }

  stop(): void {
    if (this.listening) window.removeEventListener(this.listening, this.onEvent, true);
    this.listening = null;
    this.az = null;
    this.pitchValue = null;
  }

  /** Oxirgi 1.2 soniyada yangi hodisa kelmagan bo'lsa sensor "yo'q" hisoblanadi */
  get(): { azimuth: number; pitch: number } | null {
    if (this.az === null || this.pitchValue === null) return null;
    if (performance.now() - this.lastEvent > 1200) return null;
    return { azimuth: this.az, pitch: this.pitchValue };
  }
}

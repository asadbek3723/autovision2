import type { CaptureAngle } from '@carvision/shared';
import { THRESHOLDS } from '../lib/frameCheck';
import { TOL, type AngleSpec, type Evaluation, type Measurements } from './criteria';

/**
 * Ko'rsatma tanlash — sof funksiya. Yuqoridan pastga birinchi mos kelgan
 * shart ko'rsatiladi (plan 03, 7-bo'lim): avval eng oson tuzatiladigan va
 * eng blokirovchi muammo.
 *
 * Yo'nalish qoidasi: mashina kadrda BALANDDA turgan bo'lsa, kamerani
 * YUQORIGA qaratish uni pastga tushiradi — shuning uchun matn shu tarzda.
 */

export type GuidanceIcon =
  | 'rotate'
  | 'sun'
  | 'car'
  | 'person'
  | 'zoom-in'
  | 'zoom-out'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'level'
  | 'hand'
  | 'focus'
  | 'check';

export interface Guidance {
  key: string;
  text: string;
  icon: GuidanceIcon;
  tone: 'bad' | 'ok';
  /** rotate ikonining yo'nalishi: 'back' — orqaga (old tomonga), 'forward' — oldinga */
  dir?: 'back' | 'forward';
}

export interface GuidanceInput {
  m: Measurements;
  ev: Evaluation;
  spec: AngleSpec;
  angle: CaptureAngle;
  detectorOn: boolean;
  demo: boolean;
}

const G = {
  orientation: { key: 'orientation', text: 'Telefonni yon holatga buring', icon: 'rotate', tone: 'bad' },
  dark: { key: 'dark', text: 'Yorug‘lik yetarli emas', icon: 'sun', tone: 'bad' },
  bright: { key: 'bright', text: 'Kadr juda yorug‘', icon: 'sun', tone: 'bad' },
  person: { key: 'person', text: 'Odam ko‘rinyapti — kamerani mashinaga qarating', icon: 'person', tone: 'bad' },
  noCar: { key: 'no-car', text: 'Mashina topilmadi — kamerani mashinaga qarating', icon: 'car', tone: 'bad' },
  closer: { key: 'closer', text: 'Yaqinroq keling', icon: 'zoom-in', tone: 'bad' },
  farther: { key: 'farther', text: 'Uzoqroq turing', icon: 'zoom-out', tone: 'bad' },
  aimUp: { key: 'aim-up', text: 'Kamerani biroz yuqoriga buring', icon: 'up', tone: 'bad' },
  aimDown: { key: 'aim-down', text: 'Kamerani biroz pastga buring', icon: 'down', tone: 'bad' },
  aimLeft: { key: 'aim-left', text: 'Kamerani biroz chapga buring', icon: 'left', tone: 'bad' },
  aimRight: { key: 'aim-right', text: 'Kamerani biroz o‘ngga buring', icon: 'right', tone: 'bad' },
  level: { key: 'level', text: 'Telefonni to‘g‘ri ushlang', icon: 'level', tone: 'bad' },
  steady: { key: 'steady', text: 'Qimirlatmay ushlang', icon: 'hand', tone: 'bad' },
  blur: { key: 'blur', text: 'Fokusni kuting', icon: 'focus', tone: 'bad' },
  ready: { key: 'ready', text: 'Tayyor — ushlab turing', icon: 'check', tone: 'ok' },
} as const satisfies Record<string, Guidance>;

export function resolveGuidance(input: GuidanceInput): Guidance {
  const { m, ev, spec, angle, detectorOn, demo } = input;
  const d = ev.details;
  const needCar = spec.strict && detectorOn && !demo;

  if (!m.landscape) return G.orientation;
  if (m.brightness < THRESHOLDS.brightnessMin) return G.dark;
  if (m.brightness > THRESHOLDS.brightnessMax) return G.bright;

  if (needCar && !ev.passes.car) {
    return m.detection.kind === 'person' ? G.person : G.noCar;
  }

  if (d.bearingError !== null && Math.abs(d.bearingError) > TOL.lockDeg) {
    const far = Math.abs(d.bearingError) > TOL.warnDeg;
    return {
      key: far ? 'rotate-far' : 'rotate-near',
      text: far
        ? `Mashina atrofida aylaning: ${angle.label}`
        : `Yana biroz aylaning: ${angle.label}`,
      icon: 'rotate',
      tone: 'bad',
      // Xato musbat: foydalanuvchi nishondan o'tib ketgan — old tomonga qaytishi kerak
      dir: d.bearingError > 0 ? 'back' : 'forward',
    };
  }

  if (needCar) {
    const c = d.clip;
    if (c.top && c.bottom) return G.farther;
    if (c.left && c.right) return G.farther;
    if (d.tooSmall) return G.closer;
    if (d.overFill) return G.farther;
    // Faqat bir tomondan qirqilgan: mashina markazdan chetga siljigan — kamerani shu tomonga buramiz
    if (c.right && !c.left) return G.aimRight;
    if (c.left && !c.right) return G.aimLeft;
    if (c.top || d.dy < -TOL.centerY) return G.aimUp;
    if (c.bottom || d.dy > TOL.centerY) return G.aimDown;
    if (d.dx > TOL.centerX) return G.aimRight;
    if (d.dx < -TOL.centerX) return G.aimLeft;
  }

  if (d.pitchBad) return G.level;
  if (m.motion > THRESHOLDS.motionMax) return G.steady;
  if (m.sharpness < THRESHOLDS.sharpnessMin) return G.blur;

  return G.ready;
}

/**
 * Ko'rsatma miltillamasligi uchun: yangi ko'rsatma faqat eskisi kamida
 * `minMs` turgan bo'lsa yoki muhimlik oshgan bo'lsa almashadi.
 */
export class GuidanceHold {
  private current: Guidance | null = null;
  private since = 0;

  constructor(private readonly minMs = 600) {}

  push(next: Guidance, now: number): Guidance {
    if (!this.current) {
      this.current = next;
      this.since = now;
      return next;
    }
    if (next.key === this.current.key) return this.current;

    // "Tayyor" darhol o'tadi (lock boshlanishi kechikmasin); qolganlari 600ms kutadi
    const urgent = next.tone === 'ok' || this.current.tone === 'ok';
    if (urgent || now - this.since >= this.minMs) {
      this.current = next;
      this.since = now;
    }
    return this.current;
  }

  reset() {
    this.current = null;
    this.since = 0;
  }
}

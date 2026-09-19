/**
 * Sensor matematikasi — sof funksiyalar (Vitest).
 *
 * Kamera yo'nalishi: W3C DeviceOrientation (Z-X'-Y'') burchaklaridan.
 *   R = Rz(alpha) · Rx(beta) · Ry(gamma)
 *   forward = R · (0, 0, −1)         // orqa kamera qurilmaning −z o'qi bo'ylab qaraydi
 * Yer koordinatalari: x — sharq, y — shimol, z — yuqori.
 * Kamera optik o'qi qurilma tanasiga qotirilgan, shuning uchun ekran
 * aylanishi (portret/landshaft) azimutga ta'sir qilmaydi.
 *
 * Mashina atrofida aylanish: foydalanuvchi doim mashinaga qaraydi, ya'ni
 * kamera azimuti = (foydalanuvchining mashinaga nisbatan yo'nalishi) + 180°.
 * Mashina oldidan chap tomonga (soat miliga TESKARI, tepadan qaraganda)
 * o'tganda azimut kamayadi, nominal burchak (0→90) esa oshadi:
 *     bearing = bearingRef + SIGN · (azCar − azRef),   SIGN = −1
 * SIGN qurilmada tekshiriladi (`?flip=1` yoki localStorage) — kod uni
 * qayta yig'masdan almashtirishga imkon beradi.
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface Pose {
  /** Soat mili bo'yicha, shimoldan (yoki boshlang'ich yo'nalishdan), 0–360 */
  azimuth: number;
  /** Ufqdan balandlik: + yuqoriga, − pastga */
  pitch: number;
}

export function normalize360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function poseFromEuler(alphaDeg: number, betaDeg: number, gammaDeg: number): Pose {
  const a = alphaDeg * D2R;
  const b = betaDeg * D2R;
  const g = gammaDeg * D2R;

  const fx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const fy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  const fz = -Math.cos(b) * Math.cos(g);

  return {
    azimuth: normalize360(Math.atan2(fx, fy) * R2D),
    pitch: Math.asin(Math.max(-1, Math.min(1, fz))) * R2D,
  };
}

/**
 * Mashina markazining azimuti: kamera azimuti + mashina kadr markazidan
 * qancha chetda ekaniga qarab tuzatish. `cx` — box markazi (0–1, video eni bo'yicha).
 */
export function azimuthToCar(camAzimuth: number, cx: number, hFovDeg = 65): number {
  return normalize360(camAzimuth + (cx - 0.5) * hFovDeg);
}

export function boxCenterX(box: { x: number; w: number }): number {
  return box.x + box.w / 2;
}

export function readSign(): 1 | -1 {
  try {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      if (q.get('flip') === '1') return 1;
      if (localStorage.getItem('carvision_compass_sign') === '1') return 1;
    }
  } catch {
    /* noop */
  }
  return -1;
}

/**
 * Nisbiy burchak hisoblagichi. Har suratdan keyin `anchor()` chaqiriladi:
 * shu paytdagi azimut = shu rakursning nominal burchagi. Shunda drift va
 * magnit xatosi faqat keyingi ~45° qadam ichida to'planadi.
 */
export class BearingEstimator {
  private azRef: number | null = null;
  private bearingRef = 0;

  constructor(private readonly sign: 1 | -1 = readSign()) {}

  get anchored(): boolean {
    return this.azRef !== null;
  }

  anchor(azCar: number, nominalBearing: number): void {
    this.azRef = azCar;
    this.bearingRef = nominalBearing;
  }

  /** Hali mahkamlanmagan bo'lsa null */
  bearing(azCar: number): number | null {
    if (this.azRef === null) return null;
    return normalize360(this.bearingRef + this.sign * angleDiff(azCar, this.azRef));
  }

  reset(): void {
    this.azRef = null;
    this.bearingRef = 0;
  }
}

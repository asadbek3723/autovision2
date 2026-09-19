/**
 * Kadr sifatini real vaqtda baholash.
 *
 * Ramka rangi shu yerdagi o'lchovlarga qarab qizil yoki yashil bo'ladi: kadr
 * AI generation uchun yaroqsiz bo'lsa, foydalanuvchi tugmani bosa olmaydi.
 * Barcha o'lchovlar oddiy tasvir statistikasi — qo'shimcha model yuklanmaydi.
 */

export type FrameIssue = 'orientation' | 'dark' | 'bright' | 'motion' | 'blur' | 'subject';

export interface FrameMetrics {
  /** O'rtacha yorqinlik, 0–255 */
  brightness: number;
  /** Laplasian dispersiyasi — qanchalik aniq (blur emas) */
  sharpness: number;
  /** Kuchli qirralar ulushi — obyekt ramkani to'ldirganini bildiradi */
  coverage: number;
  /** Oldingi kadrga nisbatan o'zgarish — qo'l titrashi */
  motion: number;
}

export interface FrameAnalysis {
  ok: boolean;
  /** Eng muhim muammo; ok bo'lsa null */
  issue: FrameIssue | null;
  metrics: FrameMetrics;
}

export const ISSUE_MESSAGES: Record<FrameIssue, string> = {
  orientation: 'Telefonni yon holatga buring',
  dark: 'Yorug‘lik yetarli emas — yorug‘roq joyga o‘ting',
  bright: 'Kadr juda yorug‘ — quyoshni orqangizga oling',
  motion: 'Kamerani qimirlatmay ushlang',
  blur: 'Kadr xira — fokusni kuting',
  subject: 'Avtomobil ramkani to‘ldirsin',
};

/** Chegaralar — real qurilmada sozlash uchun bitta joyda turadi */
export const THRESHOLDS = {
  brightnessMin: 40,
  brightnessMax: 235,
  sharpnessMin: 40,
  coverageMin: 0.045,
  motionMax: 12,
};

/** Ramkaning video koordinatalaridagi nisbiy o'rni (0–1) */
export const FRAME_RECT = { x: 0.08, y: 0.12, w: 0.84, h: 0.76 };

export class FrameAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private previous: Float32Array | null = null;

  constructor(
    private readonly width = 192,
    private readonly height = 108
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  reset(): void {
    this.previous = null;
  }

  analyze(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    isLandscape: boolean
  ): FrameAnalysis {
    const empty: FrameMetrics = { brightness: 0, sharpness: 0, coverage: 0, motion: 0 };

    if (!isLandscape) return { ok: false, issue: 'orientation', metrics: empty };
    if (!this.ctx || !sourceWidth || !sourceHeight) {
      return { ok: false, issue: 'blur', metrics: empty };
    }

    const sx = sourceWidth * FRAME_RECT.x;
    const sy = sourceHeight * FRAME_RECT.y;
    const sw = sourceWidth * FRAME_RECT.w;
    const sh = sourceHeight * FRAME_RECT.h;

    this.ctx.drawImage(source, sx, sy, sw, sh, 0, 0, this.width, this.height);
    const { data } = this.ctx.getImageData(0, 0, this.width, this.height);

    const w = this.width;
    const h = this.height;
    const gray = new Float32Array(w * h);

    let sum = 0;
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      const value = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
      gray[i] = value;
      sum += value;
    }
    const brightness = sum / gray.length;

    // Laplasian dispersiyasi (aniqlik) va gradiyent zichligi (obyekt bor-yo'qligi)
    let lapSum = 0;
    let lapSqSum = 0;
    let lapCount = 0;
    let edgeCount = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const c = gray[i]!;
        const left = gray[i - 1]!;
        const right = gray[i + 1]!;
        const up = gray[i - w]!;
        const down = gray[i + w]!;

        const lap = 4 * c - left - right - up - down;
        lapSum += lap;
        lapSqSum += lap * lap;
        lapCount++;

        if (Math.abs(right - left) + Math.abs(down - up) > 28) edgeCount++;
      }
    }

    const lapMean = lapSum / lapCount;
    const sharpness = lapSqSum / lapCount - lapMean * lapMean;
    const coverage = edgeCount / lapCount;

    let motion = 0;
    if (this.previous) {
      let diff = 0;
      for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i]! - this.previous[i]!);
      motion = diff / gray.length;
    }
    this.previous = gray;

    const metrics: FrameMetrics = { brightness, sharpness, coverage, motion };

    // Muhimlik tartibi: avval tuzatish osonini aytamiz
    let issue: FrameIssue | null = null;
    if (brightness < THRESHOLDS.brightnessMin) issue = 'dark';
    else if (brightness > THRESHOLDS.brightnessMax) issue = 'bright';
    else if (motion > THRESHOLDS.motionMax) issue = 'motion';
    else if (sharpness < THRESHOLDS.sharpnessMin) issue = 'blur';
    else if (coverage < THRESHOLDS.coverageMin) issue = 'subject';

    return { ok: issue === null, issue, metrics };
  }
}

/**
 * Ramkadagi qismni to'liq sifatda JPEG sifatida kesib oladi.
 * Ekranda ko'ringan ramka bilan aynan bir xil maydon saqlanadi.
 */
export function captureFrame(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  quality = 0.9
): Promise<Blob | null> {
  const sx = Math.round(sourceWidth * FRAME_RECT.x);
  const sy = Math.round(sourceHeight * FRAME_RECT.y);
  const sw = Math.round(sourceWidth * FRAME_RECT.w);
  const sh = Math.round(sourceHeight * FRAME_RECT.h);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

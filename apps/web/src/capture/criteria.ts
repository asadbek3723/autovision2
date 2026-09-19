import { CAPTURE_ANGLES, type CaptureAngle } from '@carvision/shared';
import { THRESHOLDS } from '../lib/frameCheck';
import {
  angleDiff,
  centerOffset,
  clipEdges,
  fillRatio,
  pixelAspect,
  type Box,
  type Clip,
} from './geometry';

/**
 * 5 ta mezon — "yashil" faqat hammasi o'tganda (plan 03, 5.4).
 * Chegaralar bir joyda: real qurilmada sozlash shu yerda.
 */

export const TOL = {
  /** Burchak xatosi shundan kichik bo'lsa LOCK */
  lockDeg: 15,
  /** Shundan katta bo'lsa "aylaning", oralig'ida "yana biroz" */
  warnDeg: 35,
  centerX: 0.1,
  centerY: 0.08,
  /** Sensor pitch: shundan oshsa faqat maslahat beriladi (bloklamaydi) */
  pitch: 14,
  edgeMargin: 0.02,
  carScore: 0.45,
  /** Ketma-ket nechta kadr o'tsa LOCK, nechta yiqilsa bekor */
  okStreak: 3,
  badStreak: 2,
  lockMs: 700,
  cooldownMs: 1200,
  introMs: 1600,
  introFirstMs: 3200,
  /** Burchakdan boshqa hammasi o'tgan holda shuncha ms qotib qolsa, qo'lda rejim taklif qilinadi */
  stuckMs: 8000,
} as const;

export type CriterionId = 'car' | 'angle' | 'distance' | 'height' | 'steady';

export interface AngleSpec {
  id: string;
  /** Nominal burchak: 0 old, 90 chap, 180 orqa, 270 o'ng */
  nominal: number;
  /** Box eni / ramka eni oralig'i */
  fill: [number, number];
  /** Box nisbati (eni/bo'yi) — faqat yumshoq tekshiruv */
  aspect: [number, number];
  /** Detektor va joylashuv mezonlari yoqilganmi (g'ildirak/salon uchun yo'q) */
  strict: boolean;
}

function specFor(angle: CaptureAngle): AngleSpec {
  if (!angle.required) {
    return { id: angle.id, nominal: angle.bearing, fill: [0, 1], aspect: [0, 99], strict: false };
  }
  const b = angle.bearing;
  if (b === 0 || b === 180) {
    return { id: angle.id, nominal: b, fill: [0.5, 0.75], aspect: [1.1, 1.9], strict: true };
  }
  if (b === 90 || b === 270) {
    return { id: angle.id, nominal: b, fill: [0.72, 0.94], aspect: [2.3, 3.6], strict: true };
  }
  return { id: angle.id, nominal: b, fill: [0.62, 0.88], aspect: [1.7, 2.6], strict: true };
}

export const ANGLE_SPECS: AngleSpec[] = CAPTURE_ANGLES.map(specFor);

export function findSpec(id: string): AngleSpec {
  return ANGLE_SPECS.find((s) => s.id === id) ?? ANGLE_SPECS[0]!;
}

export interface Detection {
  kind: 'car' | 'person' | 'none';
  score: number;
  box: Box | null;
}

export interface Measurements {
  landscape: boolean;
  brightness: number;
  sharpness: number;
  motion: number;
  detection: Detection;
  /** Sensor bo'yicha taxminiy burchak (nominal bilan solishtiriladi); null — sensor yo'q */
  bearing: number | null;
  /** Sensor pitch, gradus (+ yuqoriga); null — sensor yo'q */
  pitch: number | null;
  videoW: number;
  videoH: number;
}

export interface EvalOptions {
  rect: Box;
  /** Detektor ishlayaptimi (yuklangan) */
  detectorOn: boolean;
  /** Demo rejim — mashina mezoni o'tkazib yuboriladi */
  demo: boolean;
}

export interface Evaluation {
  passes: Record<CriterionId, boolean>;
  /** Yumshoq (bloklamaydigan) mezonlar — nuqtada boshqacha ko'rsatiladi */
  soft: Record<CriterionId, boolean>;
  allPass: boolean;
  /** Burchakdan boshqa hammasi o'tgan (kompas qotib qolgan bo'lishi mumkin) */
  allButAngle: boolean;
  details: {
    fill: number;
    aspect: number;
    aspectOk: boolean;
    clip: Clip;
    dx: number;
    dy: number;
    bearingError: number | null;
    pitchBad: boolean;
    tooSmall: boolean;
    tooBig: boolean;
    /** Faqat o'lchami katta (qirqilishsiz) */
    overFill: boolean;
  };
}

const EMPTY_CLIP: Clip = { top: false, bottom: false, left: false, right: false, any: false };

export function evaluate(m: Measurements, spec: AngleSpec, opts: EvalOptions): Evaluation {
  const { rect } = opts;
  const det = m.detection;
  const box = det.kind === 'car' && det.score >= TOL.carScore ? det.box : null;

  const soft: Record<CriterionId, boolean> = {
    car: false,
    angle: false,
    distance: false,
    height: false,
    steady: false,
  };

  /* 1. Mashina */
  let car: boolean;
  if (!spec.strict || opts.demo || !opts.detectorOn) {
    car = true;
    soft.car = true;
  } else {
    car = Boolean(box);
  }

  /* 3. Masofa va 4. Balandlik/markaz — box bo'yicha */
  let fill = 0;
  let aspect = 0;
  let clip: Clip = EMPTY_CLIP;
  let dx = 0;
  let dy = 0;
  let tooSmall = false;
  let tooBig = false;
  let overFill = false;
  let distance = true;
  let height = true;

  if (spec.strict && box && !opts.demo) {
    fill = fillRatio(box, rect);
    aspect = pixelAspect(box, m.videoW, m.videoH);
    clip = clipEdges(box, rect, TOL.edgeMargin);
    ({ dx, dy } = centerOffset(box, rect));

    tooSmall = fill < spec.fill[0];
    overFill = fill > spec.fill[1];
    tooBig = overFill || clip.left || clip.right;
    distance = !tooSmall && !tooBig;
    height =
      !clip.top && !clip.bottom && Math.abs(dx) <= TOL.centerX && Math.abs(dy) <= TOL.centerY;
  } else if (spec.strict && !opts.demo && opts.detectorOn) {
    // Mashina yo'q — masofa va balandlik ham o'tmaydi
    distance = false;
    height = false;
  } else {
    soft.distance = true;
    soft.height = true;
  }

  const aspectOk = !box || (aspect >= spec.aspect[0] * 0.75 && aspect <= spec.aspect[1] * 1.25);

  /* 2. Burchak */
  let angle = true;
  let bearingError: number | null = null;
  if (m.bearing === null || !spec.strict) {
    soft.angle = true; // sensor yo'q — bloklamaymiz
  } else {
    bearingError = angleDiff(m.bearing, spec.nominal);
    angle = Math.abs(bearingError) <= TOL.lockDeg;
  }

  /* Sensor pitch — faqat maslahat (bloklamaydi): kalibrovka qurilmada tekshiriladi */
  const pitchBad = m.pitch !== null && Math.abs(m.pitch) > TOL.pitch;

  /* 5. Barqarorlik */
  const steady =
    m.landscape &&
    m.brightness >= THRESHOLDS.brightnessMin &&
    m.brightness <= THRESHOLDS.brightnessMax &&
    m.motion <= THRESHOLDS.motionMax &&
    m.sharpness >= THRESHOLDS.sharpnessMin;

  const passes: Record<CriterionId, boolean> = { car, angle, distance, height, steady };
  const allPass = car && angle && distance && height && steady;
  const allButAngle = car && distance && height && steady;

  return {
    passes,
    soft,
    allPass,
    allButAngle,
    details: {
      fill,
      aspect,
      aspectOk,
      clip,
      dx,
      dy,
      bearingError,
      pitchBad,
      tooSmall,
      tooBig,
      overFill,
    },
  };
}

/** LOCK/histerezis: 3 ketma-ket o'tsa true, 2 ketma-ket yiqilsa false */
export class Hysteresis {
  private ok = 0;
  private bad = 0;
  state = false;

  push(pass: boolean): boolean {
    if (pass) {
      this.ok++;
      this.bad = 0;
      if (this.ok >= TOL.okStreak) this.state = true;
    } else {
      this.bad++;
      this.ok = 0;
      if (this.bad >= TOL.badStreak) this.state = false;
    }
    return this.state;
  }

  reset() {
    this.ok = 0;
    this.bad = 0;
    this.state = false;
  }
}

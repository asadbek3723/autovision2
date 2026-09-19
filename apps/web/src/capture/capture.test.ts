import { describe, expect, it } from 'vitest';
import { CAPTURE_ANGLES } from '@carvision/shared';
import { FRAME_RECT } from '../lib/frameCheck';
import { angleDiff, centerOffset, clipEdges, fillRatio, normalizeDeg, pixelAspect, smoothBox } from './geometry';
import {
  BearingEstimator,
  azimuthToCar,
  angleDiff as angleDiff360,
  normalize360,
  poseFromEuler,
} from './orientationMath';
import {
  ANGLE_SPECS,
  Hysteresis,
  TOL,
  evaluate,
  findSpec,
  type Measurements,
} from './criteria';
import { GuidanceHold, resolveGuidance } from './guidance';

const rect = FRAME_RECT;
const angle = (id: string) => CAPTURE_ANGLES.find((a) => a.id === id)!;

function meas(over: Partial<Measurements> = {}): Measurements {
  return {
    landscape: true,
    brightness: 120,
    sharpness: 200,
    motion: 2,
    detection: { kind: 'none', score: 0, box: null },
    bearing: null,
    pitch: null,
    videoW: 1920,
    videoH: 1080,
    ...over,
  };
}

/** Yo'naltiruvchi ramkaning markazida, berilgan `fill` (box eni / ramka eni) va nisbatda box */
function carBox(fill: number, aspect: number, dx = 0, dy = 0) {
  const w = rect.w * fill;
  const h = (w * 1920) / (aspect * 1080);
  return {
    x: rect.x + rect.w / 2 - w / 2 + dx * rect.w,
    y: rect.y + rect.h / 2 - h / 2 + dy * rect.h,
    w,
    h,
  };
}

const car = (box: ReturnType<typeof carBox>, score = 0.8) => ({ kind: 'car' as const, score, box });

describe('geometry', () => {
  it('burchaklarni aylanma normallashtiradi', () => {
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(180)).toBe(180);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(10, 350)).toBe(20);
  });

  it('fill, nisbat, markaz og‘ishi va qirqilishni hisoblaydi', () => {
    const b = carBox(0.8, 2.5);
    expect(fillRatio(b, rect)).toBeCloseTo(0.8, 5);
    expect(pixelAspect(b, 1920, 1080)).toBeCloseTo(2.5, 5);
    const off = centerOffset(carBox(0.8, 2.5, 0.05, -0.04), rect);
    expect(off.dx).toBeCloseTo(0.05, 5);
    expect(off.dy).toBeCloseTo(-0.04, 5);
    expect(clipEdges(b, rect).any).toBe(false);
    expect(clipEdges({ ...b, y: rect.y - 0.01 }, rect).top).toBe(true);
    expect(clipEdges({ ...b, x: rect.x + rect.w - b.w + 0.05 }, rect).right).toBe(true);
  });

  it('EMA tekislash', () => {
    const a = { x: 0, y: 0, w: 1, h: 1 };
    const b = { x: 1, y: 1, w: 2, h: 2 };
    expect(smoothBox(null, b)).toEqual(b);
    expect(smoothBox(a, b, 0.5)).toEqual({ x: 0.5, y: 0.5, w: 1.5, h: 1.5 });
  });
});

describe('sensor matematikasi', () => {
  it('tik ushlangan telefon shimolga qaraydi (α=0, β=90, γ=0)', () => {
    const p = poseFromEuler(0, 90, 0);
    expect(p.azimuth).toBeCloseTo(0, 4);
    expect(p.pitch).toBeCloseTo(0, 4);
  });

  it('α oshsa telefon soat miliga teskari buriladi (g‘arbga)', () => {
    expect(poseFromEuler(90, 90, 0).azimuth).toBeCloseTo(270, 3);
    expect(poseFromEuler(180, 90, 0).azimuth).toBeCloseTo(180, 3);
  });

  it('pitch: yuqoriga egilgan kamera musbat', () => {
    // β=100 → kamera 10° yuqoriga
    expect(poseFromEuler(0, 100, 0).pitch).toBeCloseTo(10, 3);
    expect(poseFromEuler(0, 80, 0).pitch).toBeCloseTo(-10, 3);
  });

  it('landshaft holatida (γ=−90, β=0) ham to‘g‘ri azimut beradi', () => {
    // γ=−90: forward = (cosα, sinα, 0) → azimut = 90° − α
    expect(poseFromEuler(0, 0, -90).azimuth).toBeCloseTo(90, 3);
    expect(poseFromEuler(90, 0, -90).azimuth).toBeCloseTo(0, 3);
    expect(poseFromEuler(30, 0, -90).pitch).toBeCloseTo(0, 3);
  });

  it('mashina markazi kadr o‘ngida bo‘lsa azimut soat mili tomon siljiydi', () => {
    expect(azimuthToCar(100, 0.5)).toBeCloseTo(100, 6);
    expect(azimuthToCar(100, 1, 60)).toBeCloseTo(130, 6);
    expect(azimuthToCar(5, 0, 60)).toBeCloseTo(335, 6);
  });

  it('BearingEstimator: old → chap yon (soat miliga teskari) burchakni oshiradi', () => {
    const est = new BearingEstimator(-1);
    expect(est.bearing(180)).toBeNull();
    // Old tomonda turibmiz: mashinaga janubga qaraymiz (azimut 180) — nominal 0°
    est.anchor(180, 0);
    // Chap yonga (g‘arb tomon) o‘tdik: mashinaga sharqqa qaraymiz (azimut 90) → 90°
    expect(est.bearing(90)).toBeCloseTo(90, 6);
    // Orqaga (shimol): mashinaga janubga → azimut 0 → 180°
    expect(est.bearing(0)).toBeCloseTo(180, 6);
    // O‘ng yon (sharq tomon): mashinaga g‘arbga → azimut 270 → 270°
    expect(est.bearing(270)).toBeCloseTo(270, 6);
    expect(normalize360(-90)).toBe(270);
    expect(angleDiff360(10, 350)).toBe(20);
  });

  it('qayta-mahkamlash: xatolar to‘planmaydi', () => {
    const est = new BearingEstimator(-1);
    est.anchor(180, 0);
    // 45° dan keyin sensor 8° adashgan bo‘lsa ham...
    expect(est.bearing(180 - 45 - 8)).toBeCloseTo(53, 6);
    // ...suratdan keyin nominal 45° ga mahkamlanadi va xato yo‘qoladi
    est.anchor(180 - 45 - 8, 45);
    expect(est.bearing(180 - 90 - 8)).toBeCloseTo(90, 6);
  });
});

describe('mezonlar', () => {
  const opts = { rect, detectorOn: true, demo: false };

  it('barcha rakurslar uchun spesifikatsiya bor', () => {
    expect(ANGLE_SPECS).toHaveLength(CAPTURE_ANGLES.length);
    expect(findSpec('left').nominal).toBe(90);
    expect(findSpec('front-right').nominal).toBe(315);
    expect(findSpec('wheel').strict).toBe(false);
  });

  it('mashina yo‘q bo‘lsa hech qachon o‘tmaydi (odam yoki bo‘sh kadr)', () => {
    for (const kind of ['none', 'person'] as const) {
      const ev = evaluate(meas({ detection: { kind, score: 0.9, box: null } }), findSpec('front'), opts);
      expect(ev.allPass).toBe(false);
      expect(ev.passes.car).toBe(false);
    }
  });

  it('to‘g‘ri kadrda, burchak sensori yo‘q bo‘lsa ham o‘tadi (yumshoq)', () => {
    const ev = evaluate(meas({ detection: car(carBox(0.83, 2.9)) }), findSpec('left'), opts);
    expect(ev.allPass).toBe(true);
    expect(ev.soft.angle).toBe(true);
  });

  it('noto‘g‘ri tomondan turgan bo‘lsa burchak mezoni o‘tmaydi', () => {
    const m = meas({ detection: car(carBox(0.83, 2.9)), bearing: 200 });
    const ev = evaluate(m, findSpec('left'), opts);
    expect(ev.passes.angle).toBe(false);
    expect(ev.allPass).toBe(false);
    expect(ev.allButAngle).toBe(true);
    expect(ev.details.bearingError).toBeCloseTo(110, 5);
    // 12° xato — o‘tadi
    expect(evaluate({ ...m, bearing: 102 }, findSpec('left'), opts).passes.angle).toBe(true);
  });

  it('masofa: kichik / katta', () => {
    const small = evaluate(meas({ detection: car(carBox(0.4, 2.9)) }), findSpec('left'), opts);
    expect(small.passes.distance).toBe(false);
    expect(small.details.tooSmall).toBe(true);
    const big = evaluate(meas({ detection: car(carBox(0.99, 2.9)) }), findSpec('left'), opts);
    expect(big.details.tooBig).toBe(true);
  });

  it('balandlik: mashina kadrda baland yoki pastda', () => {
    const high = evaluate(meas({ detection: car(carBox(0.83, 2.9, 0, -0.2)) }), findSpec('left'), opts);
    expect(high.passes.height).toBe(false);
    expect(high.details.dy).toBeLessThan(-TOL.centerY);
  });

  it('barqarorlik: qorong‘i, titrash, xira', () => {
    const base = { detection: car(carBox(0.83, 2.9)) };
    expect(evaluate(meas({ ...base, brightness: 10 }), findSpec('left'), opts).passes.steady).toBe(false);
    expect(evaluate(meas({ ...base, motion: 50 }), findSpec('left'), opts).passes.steady).toBe(false);
    expect(evaluate(meas({ ...base, sharpness: 1 }), findSpec('left'), opts).passes.steady).toBe(false);
    expect(evaluate(meas({ ...base, landscape: false }), findSpec('left'), opts).passes.steady).toBe(false);
  });

  it('demo rejim va detektorsiz rejimda mashina mezoni o‘tkaziladi', () => {
    const m = meas();
    expect(evaluate(m, findSpec('left'), { ...opts, demo: true }).allPass).toBe(true);
    expect(evaluate(m, findSpec('left'), { ...opts, detectorOn: false }).allPass).toBe(true);
  });

  it('g‘ildirak/salon (ixtiyoriy) rakurslarida detektor talab qilinmaydi', () => {
    expect(evaluate(meas(), findSpec('wheel'), opts).allPass).toBe(true);
  });

  it('histerezis: 3 ketma-ket o‘tsa yonadi, 2 ketma-ket yiqilsa o‘chadi', () => {
    const h = new Hysteresis();
    expect(h.push(true)).toBe(false);
    expect(h.push(true)).toBe(false);
    expect(h.push(true)).toBe(true);
    expect(h.push(false)).toBe(true);
    expect(h.push(false)).toBe(false);
    expect(h.push(true)).toBe(false);
  });
});

describe('ko‘rsatmalar', () => {
  const opts = { rect, detectorOn: true, demo: false };
  const run = (m: Measurements, id = 'left') => {
    const spec = findSpec(id);
    const ev = evaluate(m, spec, opts);
    return resolveGuidance({ m, ev, spec, angle: angle(id), detectorOn: true, demo: false });
  };

  it('prioritet: portret > yorug‘lik > odam > mashina yo‘q', () => {
    expect(run(meas({ landscape: false })).key).toBe('orientation');
    expect(run(meas({ brightness: 5 })).key).toBe('dark');
    expect(run(meas({ brightness: 250 })).key).toBe('bright');
    expect(run(meas({ detection: { kind: 'person', score: 0.9, box: null } })).key).toBe('person');
    expect(run(meas()).key).toBe('no-car');
  });

  it('burchak: uzoq/yaqin va yo‘nalish', () => {
    const base = { detection: car(carBox(0.83, 2.9)) };
    const far = run(meas({ ...base, bearing: 200 }));
    expect(far.key).toBe('rotate-far');
    expect(far.text).toContain('Chap yon');
    expect(far.dir).toBe('back');
    const near = run(meas({ ...base, bearing: 60 }));
    expect(near.key).toBe('rotate-near');
    expect(near.dir).toBe('forward');
  });

  it('masofa va kamera yo‘nalishi', () => {
    expect(run(meas({ detection: car(carBox(0.4, 2.9)) })).key).toBe('closer');
    expect(run(meas({ detection: car(carBox(0.99, 2.9)) })).key).toBe('farther');
    // Mashina kadrda BALAND → kamerani yuqoriga qaratish uni pastga tushiradi
    expect(run(meas({ detection: car(carBox(0.83, 2.9, 0, -0.2)) })).key).toBe('aim-up');
    expect(run(meas({ detection: car(carBox(0.83, 2.9, 0, 0.2)) })).key).toBe('aim-down');
    // Mashina kadrning o‘ng tomonida → kamerani o‘ngga buramiz
    expect(run(meas({ detection: car(carBox(0.83, 2.9, 0.15, 0)) })).key).toBe('aim-right');
    expect(run(meas({ detection: car(carBox(0.83, 2.9, -0.15, 0)) })).key).toBe('aim-left');
  });

  it('hammasi joyida bo‘lsa "Tayyor"', () => {
    const g = run(meas({ detection: car(carBox(0.83, 2.9)), bearing: 92 }));
    expect(g.key).toBe('ready');
    expect(g.tone).toBe('ok');
  });

  it('GuidanceHold: ko‘rsatma 600ms turadi, "Tayyor" darhol o‘tadi', () => {
    const hold = new GuidanceHold(600);
    const a = { key: 'a', text: 'A', icon: 'car', tone: 'bad' } as const;
    const b = { key: 'b', text: 'B', icon: 'car', tone: 'bad' } as const;
    const ok = { key: 'ok', text: 'OK', icon: 'check', tone: 'ok' } as const;
    expect(hold.push(a, 0).key).toBe('a');
    expect(hold.push(b, 300).key).toBe('a');
    expect(hold.push(b, 700).key).toBe('b');
    expect(hold.push(ok, 720).key).toBe('ok');
    expect(hold.push(a, 760).key).toBe('a');
  });
});

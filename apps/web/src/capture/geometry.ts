/**
 * Suratga olish geometriyasi — faqat sof funksiyalar (DOM/kamera yo'q),
 * shuning uchun Vitest bilan to'liq tekshiriladi.
 *
 * Barcha "box"lar video kadrining normallashtirilgan koordinatalarida
 * (0–1, chap-yuqori burchakdan). `rect` — ekrandagi yo'naltiruvchi ramka
 * (FRAME_RECT), u ham video koordinatalarida.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Burchakni (-180, 180] oralig'iga keltiradi */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** a − b, eng qisqa yo'l bo'yicha, ishorali (-180, 180] */
export function angleDiff(a: number, b: number): number {
  return normalizeDeg(a - b);
}

export function boxCenter(box: Box): { cx: number; cy: number } {
  return { cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
}

/** Box eni / yo'naltiruvchi ramka eni */
export function fillRatio(box: Box, rect: Box): number {
  return box.w / rect.w;
}

/** Box'ning piksel nisbati (eni/bo'yi) — video o'lchamlari bilan */
export function pixelAspect(box: Box, videoW: number, videoH: number): number {
  const h = box.h * videoH;
  return h > 0 ? (box.w * videoW) / h : 0;
}

export interface Clip {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
  any: boolean;
}

/**
 * Box yo'naltiruvchi ramkadan chiqib ketganmi (qirqilganmi).
 * `margin` — ramka o'lchamining ulushi: box chetdan kamida shuncha ichkarida bo'lishi kerak.
 */
export function clipEdges(box: Box, rect: Box, margin = 0.02): Clip {
  const mx = rect.w * margin;
  const my = rect.h * margin;
  const top = box.y < rect.y + my;
  const bottom = box.y + box.h > rect.y + rect.h - my;
  const left = box.x < rect.x + mx;
  const right = box.x + box.w > rect.x + rect.w - mx;
  return { top, bottom, left, right, any: top || bottom || left || right };
}

/** Box markazining ramka markazidan og'ishi (ramka o'lchamining ulushida; +x o'ng, +y past) */
export function centerOffset(box: Box, rect: Box): { dx: number; dy: number } {
  const { cx, cy } = boxCenter(box);
  return {
    dx: (cx - (rect.x + rect.w / 2)) / rect.w,
    dy: (cy - (rect.y + rect.h / 2)) / rect.h,
  };
}

/** Ikki box'ni tekislash (EMA): yangi = eski*(1−a) + yangi*a */
export function smoothBox(prev: Box | null, next: Box, alpha = 0.5): Box {
  if (!prev) return next;
  const k = alpha;
  return {
    x: prev.x + (next.x - prev.x) * k,
    y: prev.y + (next.y - prev.y) * k,
    w: prev.w + (next.w - prev.w) * k,
    h: prev.h + (next.h - prev.h) * k,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

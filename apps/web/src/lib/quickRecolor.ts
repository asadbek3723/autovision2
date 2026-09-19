/**
 * Tezkor rang rejimi (AI'siz): AI xizmati vaqtincha ishlamaganda mashina rangini
 * brauzerning o'zida aniq tanlangan rangga o'zgartiradi.
 *
 * Usul: mashina markazidagi kuzov rangini namuna qilib olamiz, shu rangga (Lab
 * fazosida) o'xshash va namunaga ulangan piksellarni kuzov deb hisoblaymiz
 * (oyna/shina qorong'i bo'lgani uchun chiqib ketadi), so'ng ularning yorug'lik va soya
 * o'yinini saqlagan holda rangini almashtiramiz. Bu AI emas — faqat rang almashtiradi;
 * far, disk va boshqa qismlar uchun AI kerak.
 */

type Lab = [number, number, number];

const MAX_SIDE = 1100;

/* ------------------------------------------------------------ rang fazolari */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

const XN = 0.95047;
const ZN = 1.08883;

function fLab(t: number): number {
  return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;
  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * XN;
  const y = L > 8 ? fy ** 3 : L / (24389 / 27);
  const z = inv(fz) * ZN;
  return [
    linearToSrgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    linearToSrgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    linearToSrgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  ];
}

function hexToLab(hex: string): Lab {
  const h = hex.replace('#', '');
  return rgbToLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
}

/* ------------------------------------------------------------ yordamchilar */

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Rasm yuklanmadi'));
    img.src = url;
  });
}

/** Niqobni (0/1) kvadrat oyna bilan yumshatib, alfaga aylantiradi (integral tasvir bilan tez) */
function blurMask(mask: Uint8Array, w: number, h: number, radius: number): Float32Array {
  const out = new Float32Array(w * h);
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x]!;
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1]! + row;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const sum =
        integral[y1 * (w + 1) + x1]! -
        integral[y0 * (w + 1) + x1]! -
        integral[y1 * (w + 1) + x0]! +
        integral[y0 * (w + 1) + x0]!;
      out[y * w + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/* ---------------------------------------------------------------- asosiy */

/**
 * Rasmdagi mashina kuzovini `targetHex` rangiga o'zgartiradi. JPEG data URL qaytaradi.
 * Kuzov aniqlanmasa (masalan, mashina markazda emas) xato tashlaydi.
 */
export async function quickRecolor(imageUrl: string, targetHex: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas mavjud emas');
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  // Har bir piksel uchun Lab (L, a, b)
  const labL = new Float32Array(w * h);
  const labA = new Float32Array(w * h);
  const labB = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const [L, a, b] = rgbToLab(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
    labL[i] = L;
    labA[i] = a;
    labB[i] = b;
  }

  /* 1) Kuzov rangi namunasi: markaziy-pastki mintaqa (eshik/kapot/bagaj odatda shu yerda) */
  const sx0 = Math.round(w * 0.3);
  const sx1 = Math.round(w * 0.7);
  const sy0 = Math.round(h * 0.38);
  const sy1 = Math.round(h * 0.72);
  const sampleL: number[] = [];
  const sampleA: number[] = [];
  const sampleB: number[] = [];
  for (let y = sy0; y < sy1; y += 2) {
    for (let x = sx0; x < sx1; x += 2) {
      const i = y * w + x;
      if (labL[i]! < 30) continue; // shina/oyna/soya emas
      sampleL.push(labL[i]!);
      sampleA.push(labA[i]!);
      sampleB.push(labB[i]!);
    }
  }
  if (sampleL.length < 60) throw new Error('Kuzov rangi aniqlanmadi');

  // Eng ko'p uchraydigan rang (a,b) klasterini topamiz: 6x6 to'rga bo'lib sanaymiz
  const bins = new Map<string, number[]>();
  sampleA.forEach((a, k) => {
    const key = `${Math.round(a / 6)}:${Math.round(sampleB[k]! / 6)}`;
    bins.set(key, [...(bins.get(key) ?? []), k]);
  });
  const dominant = [...bins.values()].sort((p, q) => q.length - p.length)[0]!;
  const bodyL = median(dominant.map((k) => sampleL[k]!));
  const bodyA = median(dominant.map((k) => sampleA[k]!));
  const bodyB = median(dominant.map((k) => sampleB[k]!));

  /* 2) Kuzovga o'xshash + namunaga ulangan piksellar (flood fill) */
  const chromaTol = 14;
  const isBody = (i: number): boolean => {
    const dA = labA[i]! - bodyA;
    const dB = labB[i]! - bodyB;
    if (dA * dA + dB * dB > chromaTol * chromaTol) return false;
    return labL[i]! > bodyL * 0.42 && labL[i]! < 101;
  };

  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let y = sy0; y < sy1; y++) {
    for (let x = sx0; x < sx1; x++) {
      const i = y * w + x;
      if (isBody(i) && !mask[i]) {
        mask[i] = 1;
        stack.push(i);
      }
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    const push = (j: number) => {
      if (!mask[j] && isBody(j)) {
        mask[j] = 1;
        stack.push(j);
      }
    };
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  // Fon detallariga (yozuv, banner) ingichka ko'prik orqali oqib chiqmasligi uchun kuzov
  // qatorlarini zichlik bo'yicha kesamiz: mashina qatorlari keng, ko'prik/banner esa tor.
  const rowCount = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) c += mask[y * w + x]!;
    rowCount[y] = c;
  }
  const rowMax = Math.max(...rowCount);
  const rowMin = rowMax * 0.14;
  let top = Math.round((sy0 + sy1) / 2);
  let bottom = top;
  while (top > 0 && rowCount[top - 1]! >= rowMin) top--;
  while (bottom < h - 1 && rowCount[bottom + 1]! >= rowMin) bottom++;
  for (let y = 0; y < h; y++) {
    if (y < top || y > bottom) mask.fill(0, y * w, (y + 1) * w);
  }

  let covered = 0;
  for (let i = 0; i < mask.length; i++) covered += mask[i]!;
  if (covered / (w * h) < 0.03) throw new Error('Kuzov topilmadi');

  /* 3) Niqobni tozalash: kichik teshiklarni to'ldirish va chekkani yumshatish */
  const closed = blurMask(mask, w, h, 2);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < solid.length; i++) solid[i] = closed[i]! > 0.42 ? 1 : 0;
  const alpha = blurMask(solid, w, h, 1);

  /* 4) Qayta bo'yash: yorug'lik/soya saqlanadi, rang aniq nishon rangi */
  const [Lt, At, Bt] = hexToLab(targetHex);
  const contrast = Lt * 0.9 + 20;
  for (let i = 0; i < w * h; i++) {
    const m = alpha[i]!;
    if (m < 0.02) continue;
    const rel = (labL[i]! - bodyL) / Math.max(bodyL, 1);
    const L2 = Math.max(0, Math.min(100, Lt + rel * contrast));
    const chroma = Math.max(0.4, 1 - Math.abs(L2 - Lt) / 90);
    const [r, g, b] = labToRgb(L2, At * chroma, Bt * chroma);
    px[i * 4] = Math.round(px[i * 4]! * (1 - m) + r * m);
    px[i * 4 + 1] = Math.round(px[i * 4 + 1]! * (1 - m) + g * m);
    px[i * 4 + 2] = Math.round(px[i * 4 + 2]! * (1 - m) + b * m);
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

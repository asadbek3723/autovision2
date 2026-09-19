/**
 * Katalog mahsulotlari: images/ dagi xom rasmlar → fon-siz (shaffof) mahsulot rasmlari.
 * Bu modul ma'lumotni va rasm ishlovini beradi; bazaga yozish seed-catalog.mjs da.
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

export const IMAGES_DIR = new URL('../../../images/', import.meta.url);

/** Ikkita nusxa (diska.webp == 2114…webp) bo'lgani uchun bittasi ishlatiladi */
export const PRODUCTS = [
  {
    slug: 'gentra-malibu-rishotka',
    source: 'aldirishotka.webp',
    // Rasm tepasidagi "Gentra (Malibu)" yozuvi mahsulot rasmiga kirmasligi kerak
    cropTop: 190,
    category: 'grille',
    name: 'Gentra (Malibu) old rishotka panjarasi',
    description:
      'Chevrolet Gentra uchun Malibu uslubidagi xrom hoshiyali qora old rishotka (panjara). Yuqori sifatli ABS plastik.',
    brand: 'Malibu Style',
    price: 450000,
    stock: 12,
    installation_price: 100000,
    ai_hint: 'front radiator grille (chrome-framed black slatted grille)',
  },
  {
    slug: 'gentra-bmw-angel-eyes-faralar',
    source: '6d357159cd6b8cc6b5df9c666dcfe6342024080713163091892DU5DAdS1pN_jpg.webp',
    category: 'headlights',
    name: 'Gentra BMW Angel Eyes LED old faralar',
    description:
      'Gentra va Lacetti uchun BMW uslubidagi sariq DRL yoyli, linzali (projector) LED old faralar to‘plami (juft).',
    brand: 'BMW Eyes',
    price: 1800000,
    stock: 8,
    installation_price: 200000,
    ai_hint: 'front headlight pair (black projector headlights with amber U-shaped DRL light bars)',
  },
  {
    slug: 'gentra-led-halqali-orqa-faralar',
    source: 'fara.webp',
    category: 'taillights',
    name: 'Gentra LED halqali orqa stop-faralar',
    description:
      'Gentra uchun qizil LED halqali (angel eyes) qora ichki qismli orqa stop-faralar to‘plami (juft).',
    brand: 'Optra LED',
    price: 1200000,
    stock: 10,
    installation_price: 150000,
    ai_hint: 'rear taillight pair (dark red-black taillights with glowing red LED rings)',
  },
  {
    slug: 'gentra-sport-r16-disk',
    source: 'diska.webp',
    category: 'wheels',
    name: 'Gentra Sport R16 kumush qotishma disk',
    description:
      'Chevrolet Gentra, Cobalt va Lacetti uchun R16 yengil qotishma sport disk (12 spitsali, jilolangan qirrali). 4 dona to‘plam.',
    brand: 'Sport Alloy',
    price: 3500000,
    stock: 5,
    installation_price: 200000,
    ai_hint: 'alloy wheel rim (silver 12-spoke sport alloy with polished lip)',
  },
];

const CANVAS = 1024;
const PADDING = 0.86; // mahsulot kanvasning shuncha ulushini egallaydi

/** Chetdan boshlab "fon" piksellarini to'ldirish (flood fill) — faqat chetga ulangan yorug' piksellar */
function backgroundMask(data, width, height, threshold) {
  const isBg = new Uint8Array(width * height);
  const stack = [];
  const lightNeutral = (i) => {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= threshold && max - min <= 26;
  };
  const push = (x, y) => {
    const idx = y * width + x;
    if (isBg[idx] || !lightNeutral(idx)) return;
    isBg[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return isBg;
}

export async function buildProductImage(product, { threshold = 232 } = {}) {
  const raw = await readFile(new URL(product.source, IMAGES_DIR));
  let img = sharp(raw).ensureAlpha();
  const meta = await img.metadata();

  if (product.cropTop) {
    img = sharp(await img.extract({ left: 0, top: product.cropTop, width: meta.width, height: meta.height - product.cropTop }).toBuffer());
  }

  // 2x kattalashtirish: chetlarni silliq kesish uchun (asl rasmlar kichik)
  const upscaled = await img.resize({ width: (meta.width) * 2, kernel: 'lanczos3' }).toBuffer({ resolveWithObject: true });
  const { data, info } = await sharp(upscaled.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const bg = backgroundMask(data, width, height, threshold);

  // alfa kanal: fon = 0, mahsulot = 255
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < bg.length; i++) alpha[i] = bg[i] ? 0 : 255;

  // silliq chekka: 1px ichkariga toraytirib, biroz xiralashtirish (oq "halo" qolmasligi uchun)
  const softAlpha = await sharp(alpha, { raw: { width, height, channels: 1 } })
    .median(3)
    .blur(0.9)
    .linear(1.25, -32)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  if (softAlpha.length !== width * height) {
    throw new Error(`alfa kanal o'lchami mos emas: ${softAlpha.length} != ${width * height}`);
  }
  const rgba = Buffer.from(data);
  for (let i = 0; i < softAlpha.length; i++) rgba[i * 4 + 3] = softAlpha[i];

  // mahsulot chegarasiga kesib, kvadrat kanvas markaziga qo'yish
  const trimmed = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toBuffer();

  const inner = Math.round(CANVAS * PADDING);
  const fitted = await sharp(trimmed)
    .resize({ width: inner, height: inner, fit: 'inside', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.7 })
    .toBuffer();

  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fitted, gravity: 'centre' }])
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer();
}

export function validateImageMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP (bytes 0..3 'RIFF', bytes 8..11 'WEBP')
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/** Rasm o'lchami (JPEG/PNG/WEBP) — qo'shimcha kutubxonasiz, faqat sarlavhadan o'qiladi */
export function imageSize(buffer: Buffer): { width: number; height: number } | null {
  const type = validateImageMagicBytes(buffer);
  try {
    if (type === 'image/png') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    if (type === 'image/jpeg') {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1]!;
        // SOF0..SOF15 (DHT=C4, JPG=C8, DAC=CC bundan mustasno)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
      return null;
    }

    if (type === 'image/webp') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      }
      if (chunk === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ') {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
    }
  } catch {
    /* buzilgan sarlavha */
  }
  return null;
}

const ASPECTS: [string, number][] = [
  ['1:1', 1],
  ['2:3', 2 / 3],
  ['3:2', 3 / 2],
  ['3:4', 3 / 4],
  ['4:3', 4 / 3],
  ['4:5', 4 / 5],
  ['5:4', 5 / 4],
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
  ['21:9', 21 / 9],
];

/** AI modellari qabul qiladigan eng yaqin nisbat (kadr qirqilmasligi va cho'zilmasligi uchun) */
export function nearestAspectRatio(buffer: Buffer): string | null {
  const size = imageSize(buffer);
  if (!size || !size.width || !size.height) return null;
  const ratio = size.width / size.height;
  return ASPECTS.reduce((best, cur) =>
    Math.abs(Math.log(cur[1] / ratio)) < Math.abs(Math.log(best[1] / ratio)) ? cur : best
  )[0];
}

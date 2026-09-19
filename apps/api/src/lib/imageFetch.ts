import { nearestAspectRatio } from './imageSniff.js';

/** Rasmni yuklab olish. Faqat o'zimiz bilgan URL'lar (Supabase Storage, AI provayder CDN) uchun. */
export async function fetchImage(
  url: string,
  timeoutMs = 15_000
): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`Rasmni oqib bolmadi (${response.status}): ${url.slice(0, 80)}`);
  }
  const mimeType = (response.headers.get('content-type') ?? 'image/jpeg').split(';')[0]!.trim();
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
}

/**
 * Rasmning nisbatini ("16:9" kabi) faqat sarlavhasini o'qib aniqlaydi — Range so'rovi
 * bilan birinchi 128 KB olinadi, butun fayl yuklanmaydi.
 *
 * Nega kerak: nisbat berilmasa, model natijani kvadrat qilib qaytaradi va mashinaning
 * chetlarini qirqib tashlaydi.
 */
export async function probeAspectRatio(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-131071' },
      signal: AbortSignal.timeout(5_000),
    });
    // Server Range'ni qo'llamasa 200 bilan to'liq fayl keladi — u ham yaraydi
    if (!response.ok) return null;
    return nearestAspectRatio(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

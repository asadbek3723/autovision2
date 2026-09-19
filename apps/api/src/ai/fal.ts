import { env } from '../env.js';
import { fetchImage } from '../lib/imageFetch.js';
import { AiError, type ImageEditProvider } from './types.js';

interface FalImage {
  url?: string;
  content_type?: string;
  file_name?: string;
}

interface FalResponse {
  images?: FalImage[];
  description?: string;
  detail?: unknown;
  error?: unknown;
}

/** fal.ai qabul qiladigan nisbatlar; ro'yxatda bo'lmasa "auto" yuboriladi */
const ASPECT_RATIOS = new Set([
  '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16',
]);

/** fal xatosini o'qiladigan matnga aylantiradi (detail satr ham, massiv ham bo'lishi mumkin) */
function describeError(body: FalResponse, status: number): string {
  const raw = body.detail ?? body.error;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const entry = item as { msg?: string; loc?: unknown[] };
        return entry?.msg ? `${entry.msg}${entry.loc ? ` (${entry.loc.join('.')})` : ''}` : JSON.stringify(item);
      })
      .join('; ');
  }
  if (raw) return JSON.stringify(raw);
  return `HTTP ${status}`;
}

/**
 * fal.ai orqali rasm tahrirlash (image-to-image, ko'p reference bilan).
 *
 * Muhim: fal rasmlarni URL orqali o'zi yuklab oladi, shuning uchun mijozning kadri va
 * katalog mahsulotlari serverga tortilmaydi. Promptdagi "IMAGE 1..n" tartibi
 * `image_urls` massivining tartibiga aynan mos keladi.
 */
export const falProvider: ImageEditProvider = {
  name: 'fal',
  async editImage({ image, references, prompt, aspectRatio }) {
    if (!env.falKey) throw new AiError('config', 'FAL_KEY sozlanmagan');

    const imageUrls = [image.url, ...references.map((ref) => ref.url)];
    for (const url of imageUrls) {
      if (!/^https?:\/\//i.test(url)) {
        throw new AiError('config', 'Rasm manzili ochiq URL boʻlishi kerak (fal uni oʻzi yuklab oladi)');
      }
    }

    let response: Response;
    try {
      response = await fetch(`https://fal.run/${env.falModel}`, {
        method: 'POST',
        signal: AbortSignal.timeout(36_000),
        headers: {
          Authorization: `Key ${env.falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_urls: imageUrls,
          num_images: 1,
          output_format: 'jpeg',
          aspect_ratio: aspectRatio && ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : 'auto',
          // "pro"/"2" modellari aniqlikni tanlashga ruxsat beradi; oddiy nano-banana bu
          // maydonni bilmaydi, shuning uchun faqat kerakli modelga yuboriladi
          ...(/nano-banana-(pro|2)/.test(env.falModel) ? { resolution: env.falResolution } : {}),
        }),
      });
    } catch (err) {
      const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new AiError(timeout ? 'timeout' : 'other', `fal.ai bilan aloqa xatosi: ${(err as Error).message}`);
    }

    const body = (await response.json().catch(() => ({}))) as FalResponse;

    if (!response.ok) {
      const detail = describeError(body, response.status);
      if (response.status === 401 || response.status === 403) {
        // 403 fal'da odatda balans tugaganini bildiradi ("User is locked. Reason: TOP_UP")
        const isBalance = /balance|quota|credit|exhaust|top[_ -]?up|locked|insufficient/i.test(detail);
        throw new AiError(
          isBalance ? 'quota' : 'config',
          `fal.ai kirish xatosi (${response.status}): ${detail.slice(0, 200)}`
        );
      }
      if (response.status === 402 || response.status === 429) {
        throw new AiError('quota', `fal.ai limiti yoki balansi tugagan (${response.status}): ${detail.slice(0, 200)}`);
      }
      if (response.status === 422) {
        throw new AiError('blocked', `fal.ai so'rovni qabul qilmadi: ${detail.slice(0, 250)}`);
      }
      throw new AiError('other', `fal.ai xatosi (${response.status}): ${detail.slice(0, 300)}`);
    }

    const first = body.images?.find((item) => item.url);
    if (!first?.url) {
      throw new AiError('blocked', `fal.ai rasm qaytarmadi${body.description ? `: ${body.description.slice(0, 200)}` : ''}`);
    }

    // sync_mode yoqilgan bo'lsa url data: bo'lishi mumkin — ikkalasini ham qo'llab-quvvatlaymiz
    if (first.url.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,(.*)$/s.exec(first.url);
      if (!match) throw new AiError('other', 'fal.ai natijasini oqib bolmadi');
      return { image: Buffer.from(match[2]!, 'base64'), mimeType: match[1]! };
    }

    try {
      const result = await fetchImage(first.url, 9_000);
      return { image: result.buffer, mimeType: first.content_type ?? result.mimeType };
    } catch (err) {
      throw new AiError('other', `fal.ai natijasini yuklab bo'lmadi: ${(err as Error).message}`);
    }
  },
};

import { env } from '../env.js';
import { nearestAspectRatio } from '../lib/imageSniff.js';
import { AiError, type ImageEditProvider } from './types.js';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

/** Google Gemini image editing (image-to-image, ko'p rasmli) */
export const geminiProvider: ImageEditProvider = {
  name: 'gemini',
  async editImage({ image, mimeType, prompt, references = [] }) {
    if (!env.geminiApiKey) throw new AiError('config', 'GEMINI_API_KEY sozlanmagan');

    // Tartib muhim: 1-rasm — mashina, keyin mahsulot reference'lari, oxirida ko'rsatma
    const parts: GeminiPart[] = [
      { text: 'IMAGE 1 (customer car photo — edit this one):' },
      { inlineData: { mimeType, data: image.toString('base64') } },
    ];
    references.forEach((ref, index) => {
      parts.push({ text: `IMAGE ${index + 2} (${ref.label}):` });
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.image.toString('base64') } });
    });
    parts.push({ text: prompt });

    const url = `${env.geminiBaseUrl}/v1beta/models/${env.geminiModel}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.geminiApiKey,
    };
    // Gateway'lar (laozhang va h.k.) Bearer kutadi; Google'ga esa Bearer yuborilmaydi (OAuth deb o'ylaydi)
    if (!env.geminiBaseUrl.includes('googleapis.com')) headers.Authorization = `Bearer ${env.geminiApiKey}`;

    // Asl rasm nisbatini so'raymiz — aks holda model kvadrat qaytarib, kadrni qirqadi
    const aspectRatio = nearestAspectRatio(image);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(48_000),
        headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
          },
        }),
      });
    } catch (err) {
      const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new AiError(timeout ? 'timeout' : 'other', `Gemini bilan aloqa xatosi: ${(err as Error).message}`);
    }

    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      const detail = body.error?.message ?? 'nomalum';
      const errCode = (body.error as { code?: string | number } | undefined)?.code;
      if (
        response.status === 429 ||
        body.error?.status === 'RESOURCE_EXHAUSTED' ||
        errCode === 'insufficient_user_quota' ||
        /quota|balance/i.test(detail)
      ) {
        throw new AiError('quota', `Gemini kvotasi tugagan yoki to‘lov yoqilmagan (429): ${detail.slice(0, 200)}`);
      }
      throw new AiError('other', `Gemini xatosi (${response.status}): ${detail.slice(0, 300)}`);
    }

    if (body.promptFeedback?.blockReason) {
      throw new AiError('blocked', `Gemini so‘rovni blokladi: ${body.promptFeedback.blockReason}`);
    }

    const candidateParts = body.candidates?.[0]?.content?.parts ?? [];
    const imagePart = candidateParts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData) {
      const text = candidateParts.find((p) => p.text)?.text;
      const reason = body.candidates?.[0]?.finishReason;
      throw new AiError('blocked', `Gemini rasm qaytarmadi${reason ? ` (${reason})` : ''}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }

    return {
      image: Buffer.from(imagePart.inlineData.data, 'base64'),
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
  },
};

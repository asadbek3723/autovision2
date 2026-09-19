import { env } from '../env.js';
import type { ImageEditProvider } from './types.js';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
}

/** Google Gemini image editing (image-to-image) */
export const geminiProvider: ImageEditProvider = {
  name: 'gemini',
  async editImage({ image, mimeType, prompt }) {
    if (!env.geminiApiKey) throw new Error('GEMINI_API_KEY sozlanmagan');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: image.toString('base64') } },
              { text: prompt },
            ],
          },
        ],
      }),
    });

    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(`Gemini xatosi (${response.status}): ${body.error?.message ?? 'nomalum'}`);
    }

    const parts = body.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData) {
      const text = parts.find((p) => p.text)?.text;
      throw new Error(`Gemini rasm qaytarmadi${text ? `: ${text}` : ''}`);
    }

    return {
      image: Buffer.from(imagePart.inlineData.data, 'base64'),
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
  },
};

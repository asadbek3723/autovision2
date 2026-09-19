import { env } from '../env.js';
import type { ImageEditProvider } from './types.js';

interface OpenAIImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string };
}

/** OpenAI Images edit endpoint (gpt-image-1) */
export const openaiProvider: ImageEditProvider = {
  name: 'openai',
  async editImage({ image, mimeType, prompt }) {
    if (!env.openaiApiKey) throw new Error('OPENAI_API_KEY sozlanmagan');

    const form = new FormData();
    form.append('model', env.openaiModel);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', '1024x1024');
    form.append('image', new Blob([new Uint8Array(image)], { type: mimeType }), 'car.png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}` },
      body: form,
    });

    const body = (await response.json()) as OpenAIImageResponse;
    if (!response.ok) {
      throw new Error(`OpenAI xatosi (${response.status}): ${body.error?.message ?? 'nomalum'}`);
    }

    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new Error('OpenAI rasm qaytarmadi');

    return { image: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  },
};

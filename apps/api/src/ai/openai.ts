import { env } from '../env.js';
import { fetchImage } from '../lib/imageFetch.js';
import { AiError, type ImageEditProvider } from './types.js';

interface OpenAIImageResponse {
  data?: { b64_json?: string }[];
  error?: { message?: string; code?: string };
}

/** OpenAI Images edit endpoint (gpt-image-1) — bir nechta rasm (image[]) bilan */
export const openaiProvider: ImageEditProvider = {
  name: 'openai',
  async editImage({ image, references, prompt }) {
    if (!env.openaiApiKey) throw new AiError('config', 'OPENAI_API_KEY sozlanmagan');

    // OpenAI multipart fayl kutadi, shuning uchun rasmlarni o'zimiz yuklab olamiz
    const [original, refs] = await Promise.all([
      fetchImage(image.url),
      Promise.all(references.map((ref) => fetchImage(ref.url))),
    ]);

    const form = new FormData();
    form.append('model', env.openaiModel);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', 'auto');
    form.append('input_fidelity', 'high');
    form.append('image[]', new Blob([new Uint8Array(original.buffer)], { type: original.mimeType }), 'car.png');
    refs.forEach((ref, index) => {
      form.append('image[]', new Blob([new Uint8Array(ref.buffer)], { type: ref.mimeType }), `ref${index + 2}.png`);
    });

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        signal: AbortSignal.timeout(36_000),
        headers: { Authorization: `Bearer ${env.openaiApiKey}` },
        body: form,
      });
    } catch (err) {
      const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new AiError(timeout ? 'timeout' : 'other', `OpenAI bilan aloqa xatosi: ${(err as Error).message}`);
    }

    const body = (await response.json().catch(() => ({}))) as OpenAIImageResponse;
    if (!response.ok) {
      const detail = body.error?.message ?? 'nomalum';
      if (response.status === 429 || body.error?.code === 'insufficient_quota') {
        throw new AiError('quota', `OpenAI kvotasi tugagan (429): ${detail.slice(0, 200)}`);
      }
      throw new AiError('other', `OpenAI xatosi (${response.status}): ${detail.slice(0, 300)}`);
    }

    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new AiError('other', 'OpenAI rasm qaytarmadi');

    return { image: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  },
};

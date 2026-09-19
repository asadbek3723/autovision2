import { env } from '../env.js';
import { fetchImage } from '../lib/imageFetch.js';
import { AiError, type ImageEditProvider } from './types.js';

/**
 * API kalitsiz ishlaydigan provider — butun flow'ni (upload → generate →
 * marketplace → order) kalitlarsiz sinash uchun. Rasmni O'ZGARTIRMAY qaytaradi.
 *
 * Production'da ataylab xato beradi: aks holda foydalanuvchi "oldin" va "keyin"
 * o'rnida bir xil rasmni ko'rib, AI ishlayapti deb o'ylaydi.
 */
export const mockProvider: ImageEditProvider = {
  name: 'mock',
  async editImage({ image }) {
    if (!env.isDev) {
      throw new AiError(
        'config',
        'AI_PROVIDER sozlanmagan (mock rejimi): rasm tahrirlanmaydi. Vercel’da AI_PROVIDER va API kalitni qo‘ying.'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const original = await fetchImage(image.url);
    return { image: original.buffer, mimeType: original.mimeType };
  },
};

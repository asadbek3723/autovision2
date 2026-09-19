import type { ImageEditProvider } from './types.js';

/**
 * API kalitsiz ishlaydigan provider — butun flow'ni (upload → generate →
 * marketplace → order) kalitlarsiz sinash uchun. Original rasmni qaytaradi.
 */
export const mockProvider: ImageEditProvider = {
  name: 'mock',
  async editImage({ image, mimeType }) {
    await new Promise((r) => setTimeout(r, 1500));
    return { image, mimeType };
  },
};

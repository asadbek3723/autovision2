import { categoriesFromOptions, findGroup, type Generation } from '@carvision/shared';
import { api, ApiRequestError } from './api';
import { quickRecolor } from './quickRecolor';

/** Brauzerda yaratilgan (AI'siz) natija — server bazasida yozuvi yo'q */
export const isLocalGeneration = (generation: Generation): boolean => generation.id.startsWith('local-');

interface GenerateInput {
  carId: string;
  /** Tahrirlanadigan asl rasm URL'i */
  sourceUrl: string;
  /** Kadr tanlangan bo'lsa serverga yuboriladigan URL */
  photoUrl?: string;
  options: Record<string, string>;
  freeText?: string;
}

/**
 * AI orqali generatsiya. AI xizmati ishlamasa (limit/to'lov/sozlanmagan/vaqt tugadi) va
 * foydalanuvchi rang tanlagan bo'lsa — rang brauzerda aniq o'zgartiriladi, shunda
 * foydalanuvchi natijani ko'radi. Far, disk kabi qismlar uchun AI kerak — ular
 * zaxira rejimda qo'llanmaydi (natija sahifasida shu haqida aytiladi).
 */
/**
 * DEMO REJIMI: qanday rasm yoki mahsulot tanlanmasin, "Keyin" o'rnida doim shu tayyor
 * natija ko'rsatiladi ("Oldin" — foydalanuvchining o'z rasmi). AI chaqirilmaydi.
 * O'chirish uchun: DEMO_RESULT = false.
 */
const DEMO_RESULT = true;
const DEMO_RESULT_IMAGE = '/images/demo-result.jpg';

export async function generateWithFallback(input: GenerateInput): Promise<Generation> {
  if (DEMO_RESULT) {
    // AI ishlayotgandek qisqa kutish
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return {
      id: `demo-${Date.now()}`,
      user_id: '',
      car_id: input.carId,
      original_image: input.sourceUrl,
      generated_image: DEMO_RESULT_IMAGE,
      prompt: '',
      categories: categoriesFromOptions(input.options),
      options: input.options,
      status: 'done',
      error: null,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const { generation } = await api.generate({
      car_id: input.carId,
      photo_url: input.photoUrl,
      options: input.options,
      free_text: input.freeText,
    });
    return generation;
  } catch (error) {
    const paint = input.options.paint;
    const target = paint ? findGroup('paint')?.options.find((o) => o.value === paint)?.swatch : undefined;
    const aiProblem =
      !(error instanceof ApiRequestError) || error.status >= 500 || error.code.startsWith('ai_');
    if (!target || !aiProblem) throw error;

    let image: string;
    try {
      image = await quickRecolor(input.sourceUrl, target);
    } catch {
      throw error; // zaxira ham iloji bo'lmadi — asl (tushunarli) xatoni ko'rsatamiz
    }

    return {
      id: `local-${Date.now()}`,
      user_id: '',
      car_id: input.carId,
      original_image: input.sourceUrl,
      generated_image: image,
      prompt: '',
      categories: ['paint'],
      options: input.options,
      status: 'done',
      error: null,
      created_at: new Date().toISOString(),
    };
  }
}

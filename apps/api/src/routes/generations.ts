import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  buildEditPrompt,
  categoriesFromOptions,
  findGroup,
  isProductOption,
  type PromptProduct,
} from '@carvision/shared';
import { authenticate } from '../lib/auth.js';
import { db, uploadImage } from '../lib/supabase.js';
import { probeAspectRatio } from '../lib/imageFetch.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { AiError, getProvider, type SourceImage } from '../ai/index.js';

const DAILY_GENERATION_LIMIT = 20;

const createSchema = z.object({
  car_id: z.string().uuid(),
  /** Qaysi kadr ustida ishlash kerakligi; berilmasa muqova rasmi olinadi */
  photo_url: z.string().url().optional(),
  /** Kalit — bo'lim (headlights, wheels, paint…), qiymat — mahsulot id'si yoki rang/variant */
  options: z.record(z.string(), z.string()).default({}),
  free_text: z.string().max(400).optional(),
});

/** Provayder xatosini foydalanuvchiga tushunarli javobga aylantiradi */
function toHttpError(err: unknown): HttpError {
  if (err instanceof AiError) {
    switch (err.kind) {
      case 'quota':
        return new HttpError(
          503,
          'ai_unavailable',
          'AI xizmati hozircha ishlamayapti (limit tugagan yoki to‘lov yoqilmagan). Administratorga xabar bering.'
        );
      case 'config':
        return new HttpError(503, 'ai_unavailable', 'AI xizmati sozlanmagan. Administratorga xabar bering.');
      case 'timeout':
        return new HttpError(504, 'ai_timeout', 'AI javob berishga ulgurmadi. Qaytadan urinib ko‘ring.');
      case 'blocked':
        return new HttpError(
          422,
          'ai_rejected',
          'AI bu rasmni qayta ishlay olmadi. Boshqa rakursdagi aniqroq rasm bilan urinib ko‘ring.'
        );
    }
  }
  return new HttpError(502, 'ai_failed', 'AI generatsiya bajarilmadi. Qaytadan urinib ko‘ring.');
}

interface CatalogProductRow {
  id: string;
  name: string;
  image_url: string | null;
  is_active: boolean;
  category: { slug: string } | { slug: string }[] | null;
}

export async function generationRoutes(app: FastifyInstance) {
  /**
   * AI generation: mijozning AYNAN o'sha rasmi tahrirlanadi — tanlangan katalog
   * mahsulotlarining rasmlari reference sifatida beriladi (fara, disk, panjara…),
   * rang esa aniq HEX bilan. Xato bo'lsa soxta rasm EMAS, tushunarli xabar qaytariladi.
   */
  app.post('/api/generations', async (request) => {
    const user = await authenticate(request);

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Notogri sorov: ' + parsed.error.issues[0]?.message);
    const { car_id, photo_url, options, free_text } = parsed.data;

    if (Object.keys(options).length === 0 && !free_text?.trim()) {
      throw badRequest('Kamida bitta ozgarish tanlang');
    }

    // AI chaqiruvi pullik — foydalanuvchi boshiga kunlik limit. Serverless bo'lgani
    // uchun xotiradagi limiter ishlamaydi, shuning uchun bazadan sanaladi.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from('generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if ((count ?? 0) >= DAILY_GENERATION_LIMIT) {
      throw badRequest(`Kunlik AI generatsiya limiti (${DAILY_GENERATION_LIMIT}) tugadi. Ertaga qaytadan urinib ko'ring.`);
    }

    const { data: car } = await db
      .from('cars')
      .select('*')
      .eq('id', car_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!car) throw notFound('Avtomobil topilmadi');

    // Tanlangan kadr shu avtomobilga tegishli ekanini tekshiramiz
    let sourceImage = car.image_url as string | null;
    if (photo_url) {
      const { data: photo } = await db
        .from('car_photos')
        .select('image_url')
        .eq('car_id', car_id)
        .eq('image_url', photo_url)
        .maybeSingle();
      if (!photo) throw badRequest('Bu kadr tanlangan avtomobilga tegishli emas');
      sourceImage = photo.image_url;
    }
    if (!sourceImage) throw badRequest('Avval avtomobilni rasmga oling');

    /* ------------------------------------------- tanlovlarni tahlil qilish */
    // Takrorlanmas ro'yxat: bir mahsulot ikki marta tanlansa ham AI'ga bir marta beriladi
    const productIds = [...new Set(Object.values(options).filter(isProductOption))];
    const products: (PromptProduct & { image_url: string })[] = [];
    if (productIds.length > 0) {
      const { data: rows, error } = await db
        .from('products')
        .select('id, name, image_url, is_active, category:categories(slug)')
        .in('id', productIds);
      if (error) throw new Error(error.message);

      const byId = new Map((rows as unknown as CatalogProductRow[]).map((row) => [row.id, row]));
      for (const id of productIds) {
        const row = byId.get(id);
        if (!row || !row.is_active) throw badRequest('Tanlangan mahsulot katalogda topilmadi');
        if (!row.image_url) throw badRequest(`"${row.name}" mahsulotining rasmi yoq`);
        const category = Array.isArray(row.category) ? row.category[0] : row.category;
        products.push({ category: category?.slug ?? 'accessories', name: row.name, image_url: row.image_url });
      }
    }

    let paint: string | undefined;
    const extras: string[] = [];
    for (const [key, value] of Object.entries(options)) {
      if (isProductOption(value)) continue;
      const option = findGroup(key)?.options.find((o) => o.value === value);
      if (!option) continue;
      if (key === 'paint') paint = option.prompt;
      else extras.push(option.prompt);
    }

    if (products.length === 0 && !paint && extras.length === 0 && !free_text?.trim()) {
      throw badRequest('Kamida bitta ozgarish tanlang');
    }

    const prompt = buildEditPrompt({ paint, extras, products, freeText: free_text });
    const categories = categoriesFromOptions(options);

    const { data: generation, error } = await db
      .from('generations')
      .insert({
        user_id: user.id,
        car_id,
        original_image: sourceImage,
        // AI'ga aynan shu matn yuboriladi — nosoz natijani tekshirish uchun saqlanadi
        prompt,
        categories,
        options,
        status: 'processing',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    try {
      const provider = getProvider();

      // Asl kadr nisbati: berilmasa model natijani kvadrat qilib, mashinani qirqadi.
      // Faqat sarlavha o'qiladi (Range so'rovi), butun fayl yuklanmaydi.
      const aspectRatio = (await probeAspectRatio(sourceImage)) ?? undefined;

      const references: SourceImage[] = products.map((product) => ({
        url: product.image_url,
        label: `catalogue product: ${product.name}`,
      }));

      const result = await provider.editImage({
        image: { url: sourceImage, label: 'customer car photo' },
        references,
        prompt,
        aspectRatio,
      });

      const generatedUrl = await uploadImage(result.image, result.mimeType, `generations/${user.id}`);

      const { data: done } = await db
        .from('generations')
        .update({ generated_image: generatedUrl, status: 'done' })
        .eq('id', generation.id)
        .select('*')
        .single();

      return { generation: done ?? { ...generation, generated_image: generatedUrl, status: 'done' } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nomalum xato';
      request.log.error({ err }, 'AI generation failed');

      await db
        .from('generations')
        .update({ status: 'failed', error: message.slice(0, 500) })
        .eq('id', generation.id);

      // Reja 30-bo'limi: xato foydalanuvchiga tushunarli, retry imkoniyati bilan
      throw toHttpError(err);
    }
  });

  app.get('/api/generations', async (request) => {
    const user = await authenticate(request);
    const { data, error } = await db
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { generations: data };
  });

  app.get<{ Params: { id: string } }>('/api/generations/:id', async (request) => {
    const user = await authenticate(request);
    const { data } = await db
      .from('generations')
      .select('*')
      .eq('id', request.params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) throw notFound('Generatsiya topilmadi');
    return { generation: data };
  });
}

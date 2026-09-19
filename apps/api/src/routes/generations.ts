import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildPrompt, categoriesFromOptions } from '@carvision/shared';
import { authenticate } from '../lib/auth.js';
import { db, uploadImage } from '../lib/supabase.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getProvider } from '../ai/index.js';

const DAILY_GENERATION_LIMIT = 20;

const createSchema = z.object({
  car_id: z.string().uuid(),
  /** Qaysi kadr ustida ishlash kerakligi; berilmasa muqova rasmi olinadi */
  photo_url: z.string().url().optional(),
  options: z.record(z.string(), z.string()).default({}),
  free_text: z.string().max(400).optional(),
});

async function fetchImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Original rasmni oqib bolmadi (${response.status})`);
  const mimeType = response.headers.get('content-type') ?? 'image/jpeg';
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
}

export async function generationRoutes(app: FastifyInstance) {
  /**
   * AI generation — reja 11-bo'limidagi flow:
   * rasm → storage → AI edit → storage → natija + mos kategoriyalar.
   */
  app.post('/api/generations', async (request) => {
    const user = await authenticate(request);

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest('Notogri sorov: ' + parsed.error.issues[0]?.message);
    const { car_id, photo_url, options, free_text } = parsed.data;

    if (Object.keys(options).length === 0 && !free_text?.trim()) {
      throw badRequest('Kamida bitta ozgarish tanlang');
    }

    // AI chaqiruvi pullik (Gemini/OpenAI) — foydalanuvchi boshiga kunlik limit
    // xarajatning nazoratsiz oshib ketishidan himoya qiladi. Serverless bo'lgani
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

    const prompt = buildPrompt(options, free_text);
    const categories = categoriesFromOptions(options);

    const { data: generation, error } = await db
      .from('generations')
      .insert({
        user_id: user.id,
        car_id,
        original_image: sourceImage,
        prompt,
        categories,
        options,
        status: 'processing',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    try {
      const original = await fetchImage(sourceImage);
      const provider = getProvider();
      const result = await provider.editImage({
        image: original.buffer,
        mimeType: original.mimeType,
        prompt,
      });
      const generatedUrl = await uploadImage(
        result.image,
        result.mimeType,
        `generations/${user.id}`
      );

      const { data: done } = await db
        .from('generations')
        .update({ generated_image: generatedUrl, status: 'done' })
        .eq('id', generation.id)
        .select('*')
        .single();

      return { generation: done };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nomalum xato';
      request.log.error({ err }, 'AI generation failed');

      await db
        .from('generations')
        .update({ status: 'failed', error: message })
        .eq('id', generation.id);

      // Reja 30-bo'limi: xato foydalanuvchiga tushunarli, retry imkoniyati bilan
      throw Object.assign(new Error('AI generatsiya bajarilmadi. Qaytadan urinib koring.'), {
        statusCode: 502,
      });
    }
  });

  app.get('/api/generations', async (request) => {
    const user = await authenticate(request);
    const { data, error } = await db
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
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

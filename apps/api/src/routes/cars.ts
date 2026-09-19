import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CAPTURE_ANGLES, MAX_CAR_PHOTOS, type Car, type CarPhoto } from '@carvision/shared';
import { authenticate } from '../lib/auth.js';
import { db, uploadImage } from '../lib/supabase.js';
import { badRequest, notFound } from '../lib/errors.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 12 * 1024 * 1024;
const ANGLE_IDS = new Set(CAPTURE_ANGLES.map((a) => a.id));

/**
 * Avtomobil yozuvi bo'sh holda yaratiladi — brend, model va rangni
 * rasmlar yuklangandan keyin AI aniqlaydi, foydalanuvchi tasdiqlaydi.
 */
const createSchema = z.object({
  vehicle_model_id: z.string().uuid().optional().nullable(),
  year: z.number().int().min(1950).max(2100).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
});

type CarWithPhotos = Car & { photos: CarPhoto[] };

async function loadCar(carId: string, userId: string): Promise<CarWithPhotos> {
  const { data: car } = await db
    .from('cars')
    .select('*')
    .eq('id', carId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!car) throw notFound('Avtomobil topilmadi');

  const { data: photos } = await db
    .from('car_photos')
    .select('*')
    .eq('car_id', carId)
    .order('created_at', { ascending: true });

  return { ...(car as Car), photos: (photos ?? []) as CarPhoto[] };
}

export async function carRoutes(app: FastifyInstance) {
  /** Avtomobil yozuvi — brend/model/yil/rang tanlangandan keyin yaratiladi */
  app.post('/api/cars', async (request) => {
    const user = await authenticate(request);

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? 'Avtomobil modelini tanlang');
    }

    let model: { brand: string; model: string } | null = null;
    if (parsed.data.vehicle_model_id) {
      const { data } = await db
        .from('vehicle_models')
        .select('brand, model')
        .eq('id', parsed.data.vehicle_model_id)
        .maybeSingle();
      if (!data) throw badRequest('Bunday avtomobil modeli yoq');
      model = data;
    }

    const { data, error } = await db
      .from('cars')
      .insert({
        user_id: user.id,
        vehicle_model_id: parsed.data.vehicle_model_id ?? null,
        detected_brand: model?.brand ?? null,
        detected_model: model?.model ?? null,
        detected_year: parsed.data.year ?? null,
        detected_color: parsed.data.color ?? null,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    return { car: { ...data, photos: [] } };
  });

  /**
   * Bitta kadrni yuklash (multipart). `angle` maydoni kadr burchagini bildiradi.
   * Birinchi kadr avtomobilning muqova rasmi bo'lib qoladi.
   */
  app.post<{ Params: { id: string } }>('/api/cars/:id/photos', async (request) => {
    const user = await authenticate(request);

    const { data: car } = await db
      .from('cars')
      .select('id, image_url')
      .eq('id', request.params.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!car) throw notFound('Avtomobil topilmadi');

    const { count } = await db
      .from('car_photos')
      .select('id', { count: 'exact', head: true })
      .eq('car_id', car.id);
    if ((count ?? 0) >= MAX_CAR_PHOTOS) {
      throw badRequest(`Bitta avtomobil uchun eng kopi ${MAX_CAR_PHOTOS} ta rasm`);
    }

    const file = await request.file();
    if (!file) throw badRequest('Rasm fayli yuborilmadi');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw badRequest('Faqat JPG, PNG yoki WEBP formatdagi rasm qabul qilinadi');
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_BYTES) throw badRequest('Rasm hajmi 12MB dan oshmasligi kerak');

    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const angle = fields.angle?.value ?? '';
    if (!ANGLE_IDS.has(angle)) throw badRequest('Kadr burchagi notogri');

    const imageUrl = await uploadImage(buffer, file.mimetype, `cars/${user.id}/${car.id}`);

    const { data: photo, error } = await db
      .from('car_photos')
      .upsert({ car_id: car.id, image_url: imageUrl, angle }, { onConflict: 'car_id,angle' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    if (!car.image_url) {
      await db.from('cars').update({ image_url: imageUrl }).eq('id', car.id);
    }

    return { photo, photos_count: (count ?? 0) + 1 };
  });

  /** Kadrni qayta olish uchun o'chirish */
  app.delete<{ Params: { id: string; photoId: string } }>(
    '/api/cars/:id/photos/:photoId',
    async (request) => {
      const user = await authenticate(request);
      const car = await loadCar(request.params.id, user.id);

      const photo = car.photos.find((p) => p.id === request.params.photoId);
      if (!photo) throw notFound('Rasm topilmadi');

      await db.from('car_photos').delete().eq('id', photo.id);

      // Muqova rasmi o'chirilsa, keyingi mavjud kadr muqova bo'ladi
      if (car.image_url === photo.image_url) {
        const next = car.photos.find((p) => p.id !== photo.id);
        await db
          .from('cars')
          .update({ image_url: next?.image_url ?? null })
          .eq('id', car.id);
      }

      return { ok: true };
    }
  );

  app.get('/api/cars', async (request) => {
    const user = await authenticate(request);
    const { data, error } = await db
      .from('cars')
      .select('*, photos:car_photos(id, car_id, image_url, angle, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { cars: data };
  });

  app.get<{ Params: { id: string } }>('/api/cars/:id', async (request) => {
    const user = await authenticate(request);
    return { car: await loadCar(request.params.id, user.id) };
  });
}

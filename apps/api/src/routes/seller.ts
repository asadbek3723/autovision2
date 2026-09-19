import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ORDER_STATUS_FLOW,
  LOW_STOCK_THRESHOLD,
  findCreditPackage,
  type OrderStatus,
} from '@carvision/shared';
import { requireSeller } from '../lib/auth.js';
import { db, uploadImage } from '../lib/supabase.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validateImageMagicBytes } from '../lib/imageSniff.js';
import { getProvider } from '../ai/index.js';
import { PRODUCT_SELECT, shapeProduct } from './catalog.js';
import { ORDER_SELECT } from './orders.js';
import { env } from '../env.js';

const productSchema = z.object({
  name: z.string().min(2, 'Mahsulot nomini kiriting').max(120),
  description: z.string().max(1000).optional().nullable(),
  category_id: z.string().uuid(),
  price: z.number().nonnegative().max(999999999, 'Narx juda yuqori'),
  stock: z.number().int().nonnegative('Ombor manfiy boʻlishi mumkin emas').max(99999, 'Ombor miqdori juda yuqori').default(0),
  brand: z.string().max(80).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  installation_available: z.boolean().default(false),
  installation_price: z.number().nonnegative().optional().nullable(),
  vehicle_model_ids: z.array(z.string().uuid()).default([]),
});

const profileSchema = z.object({
  business_name: z.string().min(2, 'Biznes nomini kiriting').max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
});

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function sellerRoutes(app: FastifyInstance) {
  /** Sotuvchi profili */
  app.get('/api/seller/profile', async (request) => {
    const { seller } = await requireSeller(request);
    return { seller };
  });

  /** Sotuvchi profilini tahrirlash */
  app.patch('/api/seller/profile', async (request) => {
    const { seller } = await requireSeller(request);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Notoʻgʻri maʼlumot');

    const patch: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      patch[key] = typeof value === 'string' ? value.trim() : value;
    }
    if (patch.business_name === '') throw badRequest('Biznes nomini kiriting');

    if (Object.keys(patch).length === 0) return { seller };

    const { data, error } = await db
      .from('sellers')
      .update(patch)
      .eq('id', seller.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { seller: data };
  });

  /** Seller statistikasi */
  app.get('/api/seller/stats', async (request) => {
    const { seller } = await requireSeller(request);

    const [products, orders] = await Promise.all([
      db.from('products').select('id, stock').eq('seller_id', seller.id).eq('is_active', true),
      db.from('orders').select('id, status, total').eq('seller_id', seller.id),
    ]);

    const productRows = products.data ?? [];
    const orderRows = orders.data ?? [];

    return {
      stats: {
        products_count: productRows.length,
        low_stock_count: productRows.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
        orders_count: orderRows.length,
        new_orders_count: orderRows.filter((o) => o.status === 'new').length,
        revenue: orderRows
          .filter((o) => o.status === 'completed')
          .reduce((sum, o) => sum + Number(o.total), 0),
        credits: seller.credits,
      },
    };
  });

  /** Kredit balansi va tarixi */
  app.get('/api/seller/credits', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('seller_credit_transactions')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { credits: seller.credits, transactions: data ?? [] };
  });

  /** Kredit sotib olish */
  app.post<{ Body: { package_id?: string } }>('/api/seller/credits/purchase', async (request, reply) => {
    const { seller } = await requireSeller(request);

    if (env.paymentsMode === 'off') {
      reply.status(503);
      return {
        error: 'payments_not_configured',
        message: 'Kredit sotib olish xizmati hozircha mavjud emas. Maʼlumot uchun sotuvchilar boʻlimiga murojaat qiling.',
      };
    }

    const pkg = findCreditPackage(request.body?.package_id ?? '');
    if (!pkg) throw badRequest('Notoʻgʻri kredit paketi');

    const { data: updatedCredits, error } = await db.rpc('add_seller_credits', {
      p_seller: seller.id,
      p_amount: pkg.credits,
      p_package: pkg.id,
    });

    if (error) throw new Error(error.message);

    const { data: updatedSeller } = await db
      .from('sellers')
      .select('*')
      .eq('id', seller.id)
      .single();

    return { seller: updatedSeller };
  });

  /** AI rasm generatsiyasi */
  app.post('/api/seller/generate', async (request) => {
    const { seller } = await requireSeller(request);
    if (seller.credits < 1) throw badRequest('Kredit yetarli emas. Avval kredit sotib oling.');

    const file = await request.file();
    if (!file) throw badRequest('Rasm fayli yuborilmadi');

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) throw badRequest('Rasm hajmi 12MB dan oshmasligi kerak');

    const mime = validateImageMagicBytes(buffer);
    if (!mime) throw badRequest('Faqat JPG, PNG yoki WEBP formatdagi haqiqiy rasm qabul qilinadi');

    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const prompt = fields.prompt?.value?.trim();
    const productId = fields.product_id?.value || null;
    if (!prompt) throw badRequest('Tavsif (prompt) kiritilmagan');

    if (productId) {
      const { data: owned } = await db
        .from('products')
        .select('id')
        .eq('id', productId)
        .eq('seller_id', seller.id)
        .maybeSingle();
      if (!owned) throw notFound('Mahsulot topilmadi');
    }

    const baseImageUrl = await uploadImage(buffer, mime, `seller-generations/${seller.id}`);

    const { data: generation, error } = await db
      .from('seller_generations')
      .insert({
        seller_id: seller.id,
        product_id: productId,
        base_image: baseImageUrl,
        prompt,
        status: 'processing',
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    // Atomik kredit kamaytirish
    const { error: creditErr } = await db.rpc('consume_seller_credit', { p_seller: seller.id });
    if (creditErr) {
      await db
        .from('seller_generations')
        .update({ status: 'failed', error: 'Kredit yetarli emas' })
        .eq('id', generation.id);
      throw badRequest('Kredit yetarli emas. Avval kredit sotib oling.');
    }

    try {
      const provider = getProvider();
      // Asl rasm allaqachon Storage'ga yuklangan — provayder uni URL orqali oladi
      const result = await provider.editImage({
        image: { url: baseImageUrl, label: 'seller product photo' },
        references: [],
        prompt,
      });
      const resultUrl = await uploadImage(result.image, result.mimeType, `seller-generations/${seller.id}`);

      const { data: done } = await db
        .from('seller_generations')
        .update({ result_image: resultUrl, status: 'done' })
        .eq('id', generation.id)
        .select('*')
        .single();

      if (productId) {
        await db.from('products').update({ image_url: resultUrl }).eq('id', productId);
      }

      return { generation: done };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nomaʼlum xato';
      request.log.error({ err }, 'Seller AI generation failed');
      await db.from('seller_generations').update({ status: 'failed', error: message }).eq('id', generation.id);

      // Refund
      try {
        await db.rpc('refund_seller_credit', { p_seller: seller.id });
      } catch {}
      throw Object.assign(new Error('AI generatsiya bajarilmadi. Kredit qaytarildi.'), { statusCode: 502 });
    }
  });

  app.get('/api/seller/generations', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('seller_generations')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { generations: data ?? [] };
  });

  app.get('/api/seller/products', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { products: (data ?? []).map((p) => shapeProduct(p as never)) };
  });

  app.post('/api/seller/products', async (request) => {
    const { seller } = await requireSeller(request);
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Notoʻgʻri maʼlumot');

    const { vehicle_model_ids, ...fields } = parsed.data;

    const { data, error } = await db
      .from('products')
      .insert({ ...fields, seller_id: seller.id })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    if (vehicle_model_ids.length > 0) {
      await db
        .from('product_compatibility')
        .insert(vehicle_model_ids.map((id) => ({ product_id: data.id, vehicle_model_id: id })));
    }

    const { data: full } = await db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', data.id)
      .single();
    return { product: shapeProduct(full as never) };
  });

  app.patch<{ Params: { id: string } }>('/api/seller/products/:id', async (request) => {
    const { seller } = await requireSeller(request);
    const parsed = productSchema.partial().safeParse(request.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Notoʻgʻri maʼlumot');

    const { vehicle_model_ids, ...fields } = parsed.data;

    const { data: owned } = await db
      .from('products')
      .select('id')
      .eq('id', request.params.id)
      .eq('seller_id', seller.id)
      .maybeSingle();
    if (!owned) throw notFound('Mahsulot topilmadi');

    if (Object.keys(fields).length > 0) {
      const { error } = await db.from('products').update(fields).eq('id', owned.id);
      if (error) throw new Error(error.message);
    }

    if (vehicle_model_ids) {
      await db.from('product_compatibility').delete().eq('product_id', owned.id);
      if (vehicle_model_ids.length > 0) {
        await db
          .from('product_compatibility')
          .insert(vehicle_model_ids.map((id) => ({ product_id: owned.id, vehicle_model_id: id })));
      }
    }

    const { data: full } = await db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', owned.id)
      .single();
    return { product: shapeProduct(full as never) };
  });

  app.delete<{ Params: { id: string } }>('/api/seller/products/:id', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('products')
      .update({ is_active: false })
      .eq('id', request.params.id)
      .eq('seller_id', seller.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Mahsulot topilmadi');
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/seller/products/:id/restore', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('products')
      .update({ is_active: true })
      .eq('id', request.params.id)
      .eq('seller_id', seller.id)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Mahsulot topilmadi');
    return { ok: true };
  });

  app.post('/api/seller/products/image', async (request) => {
    await requireSeller(request);

    const file = await request.file();
    if (!file) throw badRequest('Rasm fayli yuborilmadi');

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_IMAGE_BYTES) throw badRequest('Rasm hajmi 12MB dan oshmasligi kerak');

    const mime = validateImageMagicBytes(buffer);
    if (!mime) throw badRequest('Faqat JPG, PNG yoki WEBP formatdagi haqiqiy rasm qabul qilinadi');

    const imageUrl = await uploadImage(buffer, mime, 'products');
    return { image_url: imageUrl };
  });

  app.get('/api/seller/orders', async (request) => {
    const { seller } = await requireSeller(request);
    const { data, error } = await db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { orders: data };
  });

  app.patch<{ Params: { id: string }; Body: { status?: OrderStatus } }>(
    '/api/seller/orders/:id',
    async (request) => {
      const { seller } = await requireSeller(request);
      const next = request.body?.status;
      if (!next) throw badRequest('status koʻrsatilmadi');

      const { data: updated, error } = await db.rpc('set_order_status', {
        p_order: request.params.id,
        p_seller: seller.id,
        p_next: next,
      });

      if (error) {
        if (error.message.includes('INVALID_TRANSITION')) {
          throw badRequest('Bu statusga oʻtish mumkin emas');
        }
        if (error.message.includes('ORDER_NOT_FOUND')) {
          throw notFound('Buyurtma topilmadi');
        }
        throw new Error(error.message);
      }

      const { data: full } = await db
        .from('orders')
        .select(ORDER_SELECT)
        .eq('id', request.params.id)
        .single();
      return { order: full };
    }
  );
}

import type { FastifyInstance } from 'fastify';
import { isProductOption, type ProductWithRelations } from '@carvision/shared';
import { db } from '../lib/supabase.js';
import { notFound } from '../lib/errors.js';

const PRODUCT_SELECT = `
  *,
  category:categories(id, slug, name),
  seller:sellers(id, business_name, verified, phone),
  compatibility:product_compatibility(vehicle_model:vehicle_models(*))
`;

type RawProduct = Record<string, unknown> & {
  compatibility?: { vehicle_model: unknown }[] | null;
};

function shape(product: RawProduct): ProductWithRelations {
  const { compatibility, ...rest } = product;
  return {
    ...rest,
    price: Number(rest.price),
    installation_price:
      rest.installation_price === null ? null : Number(rest.installation_price),
    compatibility: (compatibility ?? []).map((c) => c.vehicle_model).filter(Boolean),
  } as ProductWithRelations;
}

interface ProductQuery {
  /** vergul bilan ajratilgan kategoriya slug'lari — AI konfiguratsiyasidan keladi */
  categories?: string;
  /** vergul bilan ajratilgan mahsulot id'lari — foydalanuvchi tanlagan mahsulotlar */
  ids?: string;
  vehicle_model_id?: string;
  search?: string;
  seller_id?: string;
  limit?: string;
  offset?: string;
}

export async function catalogRoutes(app: FastifyInstance) {
  /** Faqat aktiv mahsuloti bor kategoriyalar — bo'sh chiplar ko'rsatilmaydi */
  app.get('/api/categories', async () => {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);

    const { data: used } = await db.from('products').select('category_id').eq('is_active', true);
    const usedIds = new Set((used ?? []).map((row) => row.category_id as string));
    return { categories: (data ?? []).filter((c) => usedIds.has(c.id)) };
  });

  app.get('/api/vehicle-models', async () => {
    const { data, error } = await db
      .from('vehicle_models')
      .select('*')
      .order('brand', { ascending: true })
      .order('model', { ascending: true });
    if (error) throw new Error(error.message);
    return { vehicle_models: data ?? [] };
  });

  /**
   * Marketplace qidiruvi. Bazadagi xato yashirilmaydi (soxta ro'yxat qaytarilmaydi).
   */
  app.get<{ Querystring: ProductQuery }>('/api/products', async (request) => {
    const { categories, ids, search, seller_id } = request.query;
    const limit = Math.min(Math.max(Number(request.query.limit) || 60, 1), 100);

    let query = db.from('products').select(PRODUCT_SELECT).eq('is_active', true);

    if (ids) {
      const list = ids.split(',').map((s) => s.trim()).filter(isProductOption);
      if (list.length === 0) return { products: [] };
      query = query.in('id', list);
    }

    if (categories) {
      const slugs = categories.split(',').map((s) => s.trim()).filter(Boolean);
      if (slugs.length > 0) {
        const { data: cats } = await db.from('categories').select('id').in('slug', slugs);
        const catIds = (cats ?? []).map((c) => c.id);
        if (catIds.length === 0) return { products: [] };
        query = query.in('category_id', catIds);
      }
    }

    if (seller_id) query = query.eq('seller_id', seller_id);
    if (search) query = query.ilike('name', `%${search.replace(/[%,]/g, ' ')}%`);

    const { data, error } = await query.order('created_at', { ascending: true }).limit(limit);
    if (error) throw new Error(error.message);
    return { products: (data as RawProduct[]).map(shape) };
  });

  app.get<{ Params: { id: string } }>('/api/products/:id', async (request) => {
    if (!isProductOption(request.params.id)) throw notFound('Mahsulot topilmadi');

    const { data } = await db
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('id', request.params.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) throw notFound('Mahsulot topilmadi');
    return { product: shape(data as RawProduct) };
  });
}

export { PRODUCT_SELECT, shape as shapeProduct };

import type { FastifyInstance } from 'fastify';
import type { ProductWithRelations } from '@carvision/shared';
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
  vehicle_model_id?: string;
  search?: string;
  seller_id?: string;
  limit?: string;
  offset?: string;
}

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => {
    const { data, error } = await db
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return { categories: data };
  });

  app.get('/api/vehicle-models', async () => {
    const { data, error } = await db
      .from('vehicle_models')
      .select('*')
      .order('brand', { ascending: true })
      .order('model', { ascending: true });
    if (error) throw new Error(error.message);
    return { vehicle_models: data };
  });

  /**
   * Marketplace qidiruvi. Reja 12-bo'limi: AI konfiguratsiyasida tanlangan
   * kategoriyalar + avtomobil modeli bo'yicha mos mahsulotlar.
   */
  app.get<{ Querystring: ProductQuery }>('/api/products', async (request) => {
    const { categories, vehicle_model_id, search, seller_id } = request.query;
    const limit = Math.min(Number(request.query.limit ?? 50), 100);
    const offset = Number(request.query.offset ?? 0);

    // Backend service_role kaliti bilan ishlaydi va RLS'ni chetlab o'tadi,
    // shuning uchun is_active filtri shu yerda qo'lda qo'yiladi — aks holda
    // sotuvchi o'chirgan (is_active=false) mahsulotlar ham katalogda chiqib qoladi.
    let query = db.from('products').select(PRODUCT_SELECT).eq('is_active', true);

    if (categories) {
      const slugs = categories.split(',').map((s) => s.trim()).filter(Boolean);
      if (slugs.length > 0) {
        const { data: cats } = await db.from('categories').select('id').in('slug', slugs);
        const ids = (cats ?? []).map((c) => c.id);
        if (ids.length === 0) return { products: [] };
        query = query.in('category_id', ids);
      }
    }

    if (vehicle_model_id) {
      const { data: compat } = await db
        .from('product_compatibility')
        .select('product_id')
        .eq('vehicle_model_id', vehicle_model_id);
      const ids = (compat ?? []).map((c) => c.product_id);
      if (ids.length === 0) return { products: [] };
      query = query.in('id', ids);
    }

    if (seller_id) query = query.eq('seller_id', seller_id);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

    return { products: (data ?? []).map((p) => shape(p as RawProduct)) };
  });

  app.get<{ Params: { id: string } }>('/api/products/:id', async (request) => {
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

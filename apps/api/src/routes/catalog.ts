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

const DEFAULT_PRODUCTS: ProductWithRelations[] = [
  {
    id: 'p-1',
    seller_id: 's-1',
    category_id: 'c-1',
    name: 'Gentra (Malibu) Old Rishotka Panjara',
    description: 'Chevrolet Gentra uchun Malibu style xrom va qora oldi rishotka (panjara). Yuqori sifatli ABS plastik.',
    price: 450000,
    stock: 12,
    brand: 'Malibu Style',
    installation_available: true,
    installation_price: 100000,
    is_active: true,
    image_url: '/images/aldirishotka.webp',
    created_at: new Date().toISOString(),
    category: { id: 'c-1', slug: 'front-bumper', name: 'Oldi bamper' },
    seller: { id: 's-1', business_name: 'Gentra Tuning Garage', verified: true, phone: '+998901234567' },
    compatibility: [],
  },
  {
    id: 'p-2',
    seller_id: 's-1',
    category_id: 'c-2',
    name: 'Gentra BMW Angel Eyes LED Old Faralar',
    description: 'Gentra va Lacetti uchun BMW uslubidagi sariq DRL va linzali LED old faralar to’plami.',
    price: 1800000,
    stock: 8,
    brand: 'BMW Eyes',
    installation_available: true,
    installation_price: 200000,
    is_active: true,
    image_url: '/images/6d357159cd6b8cc6b5df9c666dcfe6342024080713163091892DU5DAdS1pN_jpg.webp',
    created_at: new Date().toISOString(),
    category: { id: 'c-2', slug: 'headlights', name: 'Faralar' },
    seller: { id: 's-1', business_name: 'Gentra Tuning Garage', verified: true, phone: '+998901234567' },
    compatibility: [],
  },
  {
    id: 'p-3',
    seller_id: 's-1',
    category_id: 'c-3',
    name: 'Gentra Optra / Mercedes LED Orqa Faralar',
    description: 'Gentra uchun Mercedes & Optra uslubida qizil halqali LED orqa stop-fara to’plami.',
    price: 1200000,
    stock: 10,
    brand: 'Optra LED',
    installation_available: true,
    installation_price: 150000,
    is_active: true,
    image_url: '/images/fara.webp',
    created_at: new Date().toISOString(),
    category: { id: 'c-3', slug: 'taillights', name: 'Orqa chiroqlar' },
    seller: { id: 's-1', business_name: 'Gentra Tuning Garage', verified: true, phone: '+998901234567' },
    compatibility: [],
  },
  {
    id: 'p-4',
    seller_id: 's-1',
    category_id: 'c-4',
    name: 'Gentra Sport R16 Kumush Qotishma Diska',
    description: 'Chevrolet Gentra, Cobalt va Lacetti uchun R16 yengil qotishma sport diska to’plami (4 dona).',
    price: 3500000,
    stock: 5,
    brand: 'Sport Alloy',
    installation_available: true,
    installation_price: 200000,
    is_active: true,
    image_url: '/images/diska.webp',
    created_at: new Date().toISOString(),
    category: { id: 'c-4', slug: 'wheels', name: 'Disklar' },
    seller: { id: 's-1', business_name: 'Gentra Tuning Garage', verified: true, phone: '+998901234567' },
    compatibility: [],
  },
  {
    id: 'p-5',
    seller_id: 's-1',
    category_id: 'c-5',
    name: 'Chevrolet Gentra Full Stage 2 Sport Tuning',
    description: 'To’liq Chevrolet Gentra tuning to’plami: Malibu rishotka, LED faralar, R16 diska va sport stiling.',
    price: 6500000,
    stock: 3,
    brand: 'Gentra Stage 2',
    installation_available: true,
    installation_price: 500000,
    is_active: true,
    image_url: '/images/b49d788e-38c8-45ef-9ad1-5475a421647f-960x540.jpg',
    created_at: new Date().toISOString(),
    category: { id: 'c-5', slug: 'front-bumper', name: 'Oldi bamper' },
    seller: { id: 's-1', business_name: 'Gentra Tuning Garage', verified: true, phone: '+998901234567' },
    compatibility: [],
  },
];

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => {
    try {
      const { data, error } = await db
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (!error && data && data.length > 0) return { categories: data };
    } catch {}
    return {
      categories: [
        { id: 'c-1', slug: 'front-bumper', name: 'Oldi bamper', sort_order: 1 },
        { id: 'c-2', slug: 'headlights', name: 'Faralar', sort_order: 2 },
        { id: 'c-3', slug: 'taillights', name: 'Orqa chiroqlar', sort_order: 3 },
        { id: 'c-4', slug: 'wheels', name: 'Disklar', sort_order: 4 },
      ],
    };
  });

  app.get('/api/vehicle-models', async () => {
    try {
      const { data, error } = await db
        .from('vehicle_models')
        .select('*')
        .order('brand', { ascending: true })
        .order('model', { ascending: true });
      if (!error && data && data.length > 0) return { vehicle_models: data };
    } catch {}
    return {
      vehicle_models: [
        { id: 'v-1', brand: 'Chevrolet', model: 'Gentra', year_from: 2013, year_to: 2026, body_type: 'sedan' },
        { id: 'v-2', brand: 'Chevrolet', model: 'Cobalt', year_from: 2012, year_to: 2026, body_type: 'sedan' },
        { id: 'v-3', brand: 'Chevrolet', model: 'Malibu', year_from: 2016, year_to: 2026, body_type: 'sedan' },
      ],
    };
  });

  /**
   * Marketplace qidiruvi.
   */
  app.get<{ Querystring: ProductQuery }>('/api/products', async (request) => {
    const { categories, search, seller_id } = request.query;

    try {
      let query = db.from('products').select(PRODUCT_SELECT).eq('is_active', true);

      if (categories) {
        const slugs = categories.split(',').map((s) => s.trim()).filter(Boolean);
        if (slugs.length > 0) {
          const { data: cats } = await db.from('categories').select('id').in('slug', slugs);
          const ids = (cats ?? []).map((c) => c.id);
          if (ids.length > 0) query = query.in('category_id', ids);
        }
      }

      if (seller_id) query = query.eq('seller_id', seller_id);
      if (search) query = query.ilike('name', `%${search}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return { products: (data as RawProduct[]).map(shape) };
      }
    } catch {}

    let filtered = DEFAULT_PRODUCTS;
    if (search) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }
    return { products: filtered };
  });

  app.get<{ Params: { id: string } }>('/api/products/:id', async (request) => {
    try {
      const { data } = await db
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('id', request.params.id)
        .eq('is_active', true)
        .maybeSingle();
      if (data) return { product: shape(data as RawProduct) };
    } catch {}

    const found = DEFAULT_PRODUCTS.find((p) => p.id === request.params.id) ?? DEFAULT_PRODUCTS[0];
    return { product: found };
  });
}

export { PRODUCT_SELECT, shape as shapeProduct };

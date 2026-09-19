import type { FastifyInstance } from 'fastify';
import { requireRole } from '../lib/auth.js';
import { db } from '../lib/supabase.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { loadCart } from './cart.js';

const ORDER_SELECT = `
  *,
  items:order_items(*),
  seller:sellers(id, business_name)
`;

export async function orderRoutes(app: FastifyInstance) {
  /** Savatdan buyurtma yaratish `checkout_cart` Postgres funksiyasi orqali */
  app.post<{ Body: { phone?: string; note?: string } }>('/api/orders', async (request) => {
    const user = await requireRole(request, 'user');
    const cart = await loadCart(user.id);

    if (cart.items.length === 0) throw badRequest('Savat boʻsh');

    const phone = request.body?.phone?.trim() || user.phone;
    if (!phone) throw badRequest('Telefon raqamini kiriting');

    const { data, error } = await db.rpc('checkout_cart', {
      p_user_id: user.id,
      p_phone: phone,
      p_note: request.body?.note?.trim() || null,
    });

    if (error) {
      if (error.message.includes('EMPTY_CART')) throw badRequest('Savatdagi mahsulotlar endi mavjud emas');
      if (error.message.includes('OUT_OF_STOCK')) {
        throw badRequest('Savatdagi baʼzi mahsulotlar omborda yetarli emas. Savatni yangilang.');
      }
      throw new Error(error.message);
    }

    if (phone !== user.phone) await db.from('users').update({ phone }).eq('id', user.id);

    const ids = (data ?? []).map((row: { order_id: string }) => row.order_id);
    const { data: orders } = await db.from('orders').select(ORDER_SELECT).in('id', ids);

    return { orders: orders ?? [] };
  });

  app.get('/api/orders', async (request) => {
    const user = await requireRole(request, 'user');
    const { data, error } = await db
      .from('orders')
      .select(ORDER_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { orders: data };
  });

  /** Mijoz o'z buyurtmasini bekor qilishi (faqat status='new' holatida) */
  app.post<{ Params: { id: string } }>('/api/orders/:id/cancel', async (request) => {
    const user = await requireRole(request, 'user');
    const { data, error } = await db.rpc('cancel_own_order', {
      p_order: request.params.id,
      p_user: user.id,
    });

    if (error) {
      if (error.message.includes('NOT_CANCELLABLE')) {
        throw conflict('Buyurtma ishga tushirilgan, uni bekor qilib boʻlmaydi', 'not_cancellable');
      }
      if (error.message.includes('ORDER_NOT_FOUND')) {
        throw notFound('Buyurtma topilmadi');
      }
      throw new Error(error.message);
    }

    const { data: full } = await db.from('orders').select(ORDER_SELECT).eq('id', request.params.id).single();
    return { order: full };
  });
}

export { ORDER_SELECT };

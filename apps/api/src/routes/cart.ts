import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../lib/auth.js';
import { db } from '../lib/supabase.js';
import { badRequest, notFound } from '../lib/errors.js';
import { PRODUCT_SELECT, shapeProduct } from './catalog.js';

async function getOrCreateCart(userId: string): Promise<string> {
  const { data, error } = await db
    .from('carts')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error) {
    const { data: existing } = await db.from('carts').select('id').eq('user_id', userId).maybeSingle();
    if (existing) return existing.id;
    throw new Error(error.message);
  }
  return data.id;
}

async function loadCart(userId: string) {
  const cartId = await getOrCreateCart(userId);

  const { data, error } = await db
    .from('cart_items')
    .select(`id, cart_id, product_id, quantity, product:products(${PRODUCT_SELECT})`)
    .eq('cart_id', cartId);
  if (error) throw new Error(error.message);

  const items = (data ?? []).map((item) => ({
    ...item,
    product: item.product ? shapeProduct(item.product as never) : null,
  }));

  const total = items.reduce(
    (sum, item) => sum + (Number(item.product?.price) || 0) * item.quantity,
    0
  );

  return { id: cartId, user_id: userId, items, total };
}

export async function cartRoutes(app: FastifyInstance) {
  app.get('/api/cart', async (request) => {
    const user = await authenticate(request);
    return { cart: await loadCart(user.id) };
  });

  app.post<{ Body: { product_id?: string; quantity?: number } }>(
    '/api/cart/items',
    async (request) => {
      const user = await authenticate(request);
      const parsed = z
        .object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).default(1) })
        .safeParse(request.body);
      if (!parsed.success) throw badRequest('product_id notogri');

      const { data: product } = await db
        .from('products')
        .select('id, stock')
        .eq('id', parsed.data.product_id)
        .eq('is_active', true)
        .maybeSingle();
      if (!product) throw notFound('Mahsulot topilmadi');
      if (product.stock < 1) throw badRequest('Mahsulot omborda mavjud emas');

      const cartId = await getOrCreateCart(user.id);

      const { data: existing } = await db
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', product.id)
        .maybeSingle();

      const quantity = Math.min(
        (existing?.quantity ?? 0) + parsed.data.quantity,
        product.stock
      );

      if (existing) {
        await db.from('cart_items').update({ quantity }).eq('id', existing.id);
      } else {
        await db
          .from('cart_items')
          .insert({ cart_id: cartId, product_id: product.id, quantity });
      }

      return { cart: await loadCart(user.id) };
    }
  );

  app.patch<{ Params: { id: string }; Body: { quantity?: number } }>(
    '/api/cart/items/:id',
    async (request) => {
      const user = await authenticate(request);
      const quantity = Number(request.body?.quantity);
      if (!Number.isInteger(quantity) || quantity < 0) throw badRequest('quantity notogri');

      const cartId = await getOrCreateCart(user.id);

      if (quantity === 0) {
        await db.from('cart_items').delete().eq('id', request.params.id).eq('cart_id', cartId);
      } else {
        await db
          .from('cart_items')
          .update({ quantity })
          .eq('id', request.params.id)
          .eq('cart_id', cartId);
      }

      return { cart: await loadCart(user.id) };
    }
  );

  app.delete<{ Params: { id: string } }>('/api/cart/items/:id', async (request) => {
    const user = await authenticate(request);
    const cartId = await getOrCreateCart(user.id);
    await db.from('cart_items').delete().eq('id', request.params.id).eq('cart_id', cartId);
    return { cart: await loadCart(user.id) };
  });
}

export { loadCart, getOrCreateCart };

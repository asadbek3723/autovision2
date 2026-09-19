import type { FastifyRequest } from 'fastify';
import type { User, UserRole, Seller } from '@carvision/shared';
import { resolveSession } from './sessions.js';
import { unauthorized, forbidden } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
    seller?: Seller | null;
  }
}

export const USER_COLUMNS = 'id, login, name, phone, role, is_active, created_at';

export function toPublicUser(user: User): User {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    phone: user.phone,
    role: user.role,
    created_at: user.created_at,
  };
}

export async function authenticate(request: FastifyRequest): Promise<User> {
  if (request.user) return request.user;

  const header = request.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    throw unauthorized('Avtorizatsiya tokeni yuborilmadi');
  }

  const token = header.slice(7).trim();
  const session = await resolveSession(token);
  if (!session) {
    throw unauthorized('Sessiya muddati tugagan yoki bekor qilingan. Qaytadan kiring.');
  }

  request.user = session.user;
  request.seller = session.seller;
  return request.user;
}

export async function requireRole(request: FastifyRequest, requiredRole: UserRole): Promise<User> {
  const user = await authenticate(request);
  if (user.role !== requiredRole && user.role !== 'admin') {
    throw forbidden(
      requiredRole === 'seller'
        ? 'Bu sahifa faqat sotuvchilar uchun moʻljallangan'
        : 'Bu amal uchun ruxsatingiz yetarli emas',
      'wrong_role'
    );
  }
  return user;
}

export async function requireSeller(request: FastifyRequest): Promise<{ user: User; seller: Seller }> {
  const user = await requireRole(request, 'seller');
  if (!request.seller) {
    throw forbidden('Sotuvchi profili topilmadi');
  }
  return { user, seller: request.seller };
}

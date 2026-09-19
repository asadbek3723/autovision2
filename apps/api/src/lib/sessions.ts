import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { User, Seller } from '@carvision/shared';
import { db } from './supabase.js';

const SESSION_TTL_DAYS = 30;

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export async function createSession(
  userId: string,
  request?: FastifyRequest
): Promise<{ token: string; expiresAt: string }> {
  const rawBytes = randomBytes(32);
  const token = `cv_${rawBytes.toString('base64url')}`;
  const tokenHash = hashToken(token);

  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const userAgent = request?.headers['user-agent'] ?? null;
  const ip = request?.ip ?? null;

  const { error } = await db.from('sessions').insert({
    user_id: userId,
    token_hash: `\\x${tokenHash.toString('hex')}`,
    expires_at: expiresAt,
    user_agent: userAgent,
    ip: ip,
  });

  if (error) throw new Error(`Sessiya yaratishda xato: ${error.message}`);

  return { token, expiresAt };
}

export async function resolveSession(
  token: string
): Promise<{ user: User; seller: Seller | null } | null> {
  if (!token.startsWith('cv_')) return null;

  const tokenHashHex = `\\x${hashToken(token).toString('hex')}`;

  const { data: session, error } = await db
    .from('sessions')
    .select('id, user_id, expires_at, revoked_at')
    .eq('token_hash', tokenHashHex)
    .maybeSingle();

  if (error || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: user } = await db
    .from('users')
    .select('id, login, name, phone, role, is_active, created_at')
    .eq('id', session.user_id)
    .maybeSingle();

  if (!user || user.is_active === false) return null;

  const { data: seller } = await db
    .from('sellers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // Sliding window update (last_used_at)
  await db
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', session.id);

  return { user: user as User, seller: (seller as Seller) ?? null };
}

export async function revokeSession(token: string): Promise<void> {
  if (!token.startsWith('cv_')) return;
  const tokenHashHex = `\\x${hashToken(token).toString('hex')}`;
  await db
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHashHex);
}

export async function revokeOtherSessions(userId: string, currentToken: string): Promise<void> {
  const tokenHashHex = `\\x${hashToken(currentToken).toString('hex')}`;
  await db
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .neq('token_hash', tokenHashHex)
    .is('revoked_at', null);
}

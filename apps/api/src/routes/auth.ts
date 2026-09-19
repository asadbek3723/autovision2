import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate, toPublicUser } from '../lib/auth.js';
import { db } from '../lib/supabase.js';
import { hashPassword, verifyPassword, needsRehash, DUMMY_HASH } from '../lib/password.js';
import { createSession, revokeSession, revokeOtherSessions } from '../lib/sessions.js';
import {
  registerSchema,
  loginSchema,
  passwordSchema,
  normalizePhoneUz,
  cleanLogin,
} from '../lib/validation.js';
import {
  checkGuestLimit,
  checkLoginLimit,
  checkRegisterLimit,
  recordAttempt,
  GUEST_LOGIN_PREFIX,
} from '../lib/rateLimit.js';
import { badRequest, unauthorized, conflict, unprocessable } from '../lib/errors.js';

export async function authRoutes(app: FastifyInstance) {
  /** Ro'yxatdan o'tish */
  app.post('/api/auth/register', async (request, reply) => {
    const ip = request.ip;
    await checkRegisterLimit(ip);

    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || 'form';
        fields[path] = issue.message;
      }
      throw unprocessable('Kiritilgan maʼlumotlarda xatolik bor', fields);
    }

    const input = parsed.data;
    const login = cleanLogin(input.login);
    const passwordHash = await hashPassword(input.password);
    const phone = normalizePhoneUz(input.phone);

    try {
      const { data, error } = await db.rpc('register_account', {
        p_login: login,
        p_password_hash: passwordHash,
        p_name: input.name,
        p_role: input.role,
        p_business_name: input.role === 'seller' ? input.business_name : null,
        p_phone: phone,
        p_address: input.role === 'seller' ? input.address : null,
      });

      if (error) {
        if (error.message.includes('LOGIN_TAKEN') || error.message.includes('unique constraint')) {
          await recordAttempt('register', login, ip, false);
          throw conflict('Bu login band. Boshqa login tanlang.', 'login_taken');
        }
        if (error.message.includes('INVALID_BUSINESS_NAME')) {
          throw unprocessable('Servis nomini kiriting', { business_name: 'Servis nomini kiriting' });
        }
        throw new Error(error.message);
      }

      await recordAttempt('register', login, ip, true);

      const user = data as any;
      const { token, expiresAt } = await createSession(user.id, request);

      let seller = null;
      if (user.role === 'seller') {
        const { data: sellerData } = await db
          .from('sellers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        seller = sellerData;
      }

      reply.status(201);
      return {
        token,
        expires_at: expiresAt,
        user: toPublicUser(user),
        seller,
      };
    } catch (err: any) {
      if (err.statusCode) throw err;
      throw new Error(`Roʻyxatdan oʻtishda xato: ${err?.message || err}`);
    }
  });

  /**
   * Mehmon sessiyasi — login/parolsiz kirish (auth vaqtincha o'chirilganda).
   * Parolsiz akkaunt (password_hash = null) /api/auth/login orqali kira olmaydi,
   * faqat shu qurilmadagi token orqali ishlaydi.
   */
  app.post('/api/auth/guest', async (request, reply) => {
    const ip = request.ip;
    await checkGuestLimit(ip);

    const login = `${GUEST_LOGIN_PREFIX}${randomBytes(6).toString('hex')}`;
    const { data: user, error } = await db
      .from('users')
      .insert({ login, name: 'Mehmon', role: 'user' })
      .select('*')
      .single();

    if (error || !user) {
      throw new Error(`Mehmon akkaunti yaratilmadi: ${error?.message ?? 'nomaʼlum xato'}`);
    }

    await recordAttempt('register', login, ip, true);
    const { token, expiresAt } = await createSession(user.id, request);

    reply.status(201);
    return {
      token,
      expires_at: expiresAt,
      user: toPublicUser(user as any),
      seller: null,
    };
  });

  /** Kirish */
  app.post('/api/auth/login', async (request) => {
    const ip = request.ip;
    const body = (request.body ?? {}) as Record<string, string>;
    const rawLogin = typeof body.login === 'string' ? body.login : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const login = cleanLogin(rawLogin);
    if (!login || !password) {
      throw badRequest('Login va parolni kiriting');
    }

    await checkLoginLimit(login, ip);

    const { data: user } = await db
      .from('users')
      .select('*')
      .eq('login', login)
      .maybeSingle();

    const targetHash = user?.password_hash ?? DUMMY_HASH;
    const isValid = await verifyPassword(password, targetHash);

    if (!user || !isValid || !user.password_hash) {
      await recordAttempt('login', login, ip, false);
      throw unauthorized('Login yoki parol notoʻgʻri', 'invalid_credentials');
    }

    if (user.is_active === false) {
      await recordAttempt('login', login, ip, false);
      throw unauthorized('Akkaunt bloklangan. Qoʻllab-quvvatlash xizmatiga murojaat qiling.', 'account_disabled');
    }

    await recordAttempt('login', login, ip, true);

    if (needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      await db.from('users').update({ password_hash: newHash }).eq('id', user.id);
    }

    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    const { token, expiresAt } = await createSession(user.id, request);

    let seller = null;
    if (user.role === 'seller') {
      const { data: sellerData } = await db
        .from('sellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      seller = sellerData;
    }

    return {
      token,
      expires_at: expiresAt,
      user: toPublicUser(user),
      seller,
    };
  });

  /** Chiqish */
  app.post('/api/auth/logout', async (request, reply) => {
    const header = request.headers.authorization ?? '';
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      await revokeSession(token);
    }
    reply.status(204);
    return;
  });

  /** Login bo'shligini tekshirish */
  app.get<{ Querystring: { login?: string } }>('/api/auth/login-available', async (request) => {
    const raw = request.query.login ?? '';
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      return { available: false, reason: parsed.error.issues[0]?.message };
    }

    const { data } = await db.from('users').select('id').eq('login', parsed.data).maybeSingle();
    return { available: !data };
  });

  /** Profil */
  app.get('/api/me', async (request) => {
    const user = await authenticate(request);
    let seller = null;
    if (user.role === 'seller') {
      const { data: sellerData } = await db
        .from('sellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      seller = sellerData;
    }

    return { user: toPublicUser(user), seller };
  });

  /** Profilni yangilash */
  app.patch<{ Body: { name?: string; phone?: string } }>('/api/me', async (request) => {
    const user = await authenticate(request);
    const patch: Record<string, string> = {};

    if (typeof request.body?.name === 'string') {
      const name = request.body.name.trim();
      if (name.length < 2 || name.length > 60) {
        throw badRequest('Ismingizni kiriting (2–60 belgi)');
      }
      patch.name = name;
    }

    if (typeof request.body?.phone === 'string') {
      const phone = normalizePhoneUz(request.body.phone);
      if (request.body.phone.trim() && !phone) {
        throw badRequest('Telefon formati notoʻgʻri (+998 XX XXX XX XX)');
      }
      patch.phone = phone ?? '';
    }

    if (Object.keys(patch).length === 0) return { user: toPublicUser(user) };

    const { data, error } = await db
      .from('users')
      .update(patch)
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { user: toPublicUser(data as any) };
  });

  /** Parolni almashtirish */
  app.post<{ Body: { current_password?: string; new_password?: string } }>(
    '/api/me/password',
    async (request) => {
      const user = await authenticate(request);
      const currentPassword = request.body?.current_password ?? '';
      const newPassword = request.body?.new_password ?? '';

      const { data: dbUser } = await db
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();

      if (!dbUser?.password_hash || !(await verifyPassword(currentPassword, dbUser.password_hash))) {
        throw unauthorized('Joriy parol notoʻgʻri', 'invalid_credentials');
      }

      const parsedNew = passwordSchema.safeParse(newPassword);
      if (!parsedNew.success) {
        throw badRequest(parsedNew.error.issues[0]?.message ?? 'Yangi parol mos kelmadi');
      }

      const newHash = await hashPassword(parsedNew.data);
      const now = new Date().toISOString();

      await db
        .from('users')
        .update({ password_hash: newHash, password_changed_at: now })
        .eq('id', user.id);

      const header = request.headers.authorization ?? '';
      if (header.startsWith('Bearer ')) {
        const token = header.slice(7).trim();
        await revokeOtherSessions(user.id, token);
      }

      return { ok: true };
    }
  );
}

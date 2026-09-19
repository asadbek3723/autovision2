import { db } from './supabase.js';
import { tooMany } from './errors.js';

const LOGIN_FAIL_LIMIT_KEY = 5;
const LOGIN_FAIL_LIMIT_IP = 20;
const LOGIN_WINDOW_MINUTES = 15;
const REGISTER_LIMIT_IP = 5;
const REGISTER_WINDOW_HOURS = 1;
// Umumiy Wi-Fi ortidagi ko'p qurilma bitta IP bo'lib ko'rinishi mumkin — limit keng
const GUEST_LIMIT_IP = 60;

export const GUEST_LOGIN_PREFIX = 'guest_';

export async function recordAttempt(
  kind: 'login' | 'register',
  loginKey: string | null,
  ip: string,
  success: boolean
): Promise<void> {
  await db.from('login_attempts').insert({
    kind,
    login_key: loginKey ? loginKey.toLowerCase() : null,
    ip,
    success,
  });
}

export async function checkLoginLimit(loginKey: string, ip: string): Promise<void> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: keyFails } = await db
    .from('login_attempts')
    .select('created_at')
    .eq('kind', 'login')
    .eq('login_key', loginKey.toLowerCase())
    .eq('success', false)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true });

  if (keyFails && keyFails.length >= LOGIN_FAIL_LIMIT_KEY && keyFails[0]?.created_at) {
    const oldestFail = new Date(keyFails[0].created_at).getTime();
    const retryAfter = Math.ceil((oldestFail + LOGIN_WINDOW_MINUTES * 60 * 1000 - Date.now()) / 1000);
    const minutes = Math.ceil(retryAfter / 60);
    throw tooMany(`Juda koʻp notoʻgʻri urinish. ${minutes} daqiqadan keyin qayta urinib koʻring.`, retryAfter);
  }

  const { data: ipFails } = await db
    .from('login_attempts')
    .select('created_at')
    .eq('kind', 'login')
    .eq('ip', ip)
    .eq('success', false)
    .gte('created_at', windowStart);

  if (ipFails && ipFails.length >= LOGIN_FAIL_LIMIT_IP) {
    throw tooMany(`IP manzildan juda koʻp xato urinishlar qilindi. Keyinroq qayta urinib koʻring.`, 900);
  }
}

export async function checkRegisterLimit(ip: string): Promise<void> {
  const windowStart = new Date(Date.now() - REGISTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Mehmon sessiyalari ham 'register' sifatida yoziladi — ular alohida limitga ega
  const { count } = await db
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'register')
    .eq('ip', ip)
    .not('login_key', 'like', `${GUEST_LOGIN_PREFIX}%`)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= REGISTER_LIMIT_IP) {
    throw tooMany(`Ushbu qurilmadan soatiga koʻpi bilan 5 marta roʻyxatdan oʻtish mumkin.`, 3600);
  }
}

export async function checkGuestLimit(ip: string): Promise<void> {
  const windowStart = new Date(Date.now() - REGISTER_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { count } = await db
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'register')
    .eq('ip', ip)
    .like('login_key', `${GUEST_LOGIN_PREFIX}%`)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= GUEST_LIMIT_IP) {
    throw tooMany('Juda koʻp urinish. Birozdan keyin qayta urinib koʻring.', 3600);
  }
}

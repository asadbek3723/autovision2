import { createHash, createHmac } from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Mini App initData imzosini tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60
): TelegramUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const checkString = [...params.entries()]
    .map(([key, value]) => [key, value] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secret).update(checkString).digest('hex');
  if (computed !== hash) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;

  try {
    const user = JSON.parse(rawUser) as TelegramUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

/**
 * Telegram Login Widget payloadini tekshiradi (brauzerdagi "Telegram orqali
 * kirish" tugmasi). Mini App initData'dan farqli — sekret HMAC-SHA256("WebAppData", ...)
 * emas, oddiy SHA256(bot_token) bo'ladi.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyLoginWidget(
  data: Record<string, string | undefined>,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60
): TelegramUser | null {
  if (!botToken) return null;
  const { hash, ...rest } = data;
  if (!hash) return null;

  const checkString = Object.entries(rest)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHash('sha256').update(botToken).digest();
  const computed = createHmac('sha256', secret).update(checkString).digest('hex');
  if (computed !== hash) return null;

  const authDate = Number(rest.auth_date ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const id = Number(rest.id);
  if (!id) return null;

  return {
    id,
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
  };
}

/** Dev rejim uchun: imzosiz initData'dan foydalanuvchini o'qish */
export function parseInitDataUnsafe(initData: string): TelegramUser | null {
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return null;
    const user = JSON.parse(raw) as TelegramUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

import { z } from 'zod';

export const RESERVED_LOGINS = new Set([
  'admin',
  'root',
  'support',
  'carvision',
  'api',
  'seller',
  'system',
  'null',
  'undefined',
  'test',
  'demo',
  'official',
  'help',
  'auth',
  'login',
  'register',
  'profile',
]);

export const COMMON_PASSWORDS = new Set([
  '12345678',
  'password',
  '123456789',
  'qwertyuiop',
  '1234567890',
  'carvision',
  'password123',
  'admin123',
]);

export function cleanLogin(input: string): string {
  return input.trim().toLowerCase();
}

export const loginSchema = z
  .string()
  .transform(cleanLogin)
  .pipe(
    z
      .string()
      .min(3, 'Login kamida 3 ta belgi boʻlishi kerak')
      .max(32, 'Login koʻpi bilan 32 ta belgi boʻlishi kerak')
      .regex(/^[a-z][a-z0-9_.]{2,31}$/, 'Login harf bilan boshlanishi va faqat lotin harflari, raqam, _ va . boʻlishi kerak')
      .refine((val) => !val.includes('..') && !val.includes('__'), 'Ketma-ket belgilar mumkin emas')
      .refine((val) => !val.endsWith('.') && !val.endsWith('_'), 'Login belgi bilan tugashi mumkin emas')
      .refine((val) => !RESERVED_LOGINS.has(val), 'Bu loginni ishlatib boʻlmaydi')
  );

export const passwordSchema = z
  .string()
  .min(8, 'Parol kamida 8 ta belgi boʻlishi kerak')
  .max(128, 'Parol koʻpi bilan 128 ta belgi boʻlishi kerak')
  .refine((val) => val.trim().length >= 8, 'Parol faqat boʻshliqdan iborat boʻlishi mumkin emas')
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), 'Bu parol juda oson topiladi');

export function normalizePhoneUz(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return null;
}

export const phoneUzSchema = z
  .string()
  .transform((val) => val.replace(/\s+|-|\(|\)/g, ''))
  .refine((val) => /^\+998\d{9}$/.test(val), 'Telefon formati notoʻgʻri (+998 XX XXX XX XX)');

export const registerSchema = z.object({
  role: z.enum(['user', 'seller'], { message: 'Rolni tanlang' }),
  name: z.string().trim().min(2, 'Ismingizni kiriting (2–60 belgi)').max(60, 'Ism juda uzun'),
  login: loginSchema,
  password: passwordSchema,
  business_name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
});

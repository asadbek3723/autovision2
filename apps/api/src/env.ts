import { config } from 'dotenv';
import { resolve } from 'node:path';

// Monorepo ildizidagi .env fayli barcha workspace'lar uchun umumiy
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

function required(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Muhit o'zgaruvchisi yetishmayapti: ${names.join(' yoki ')}. .env.example faylini ko'ring.`);
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');
const paymentsMode = optional('PAYMENTS_MODE', nodeEnv === 'production' ? 'off' : 'mock');

export const env = {
  port: Number(optional('PORT', '8787')),
  nodeEnv,
  isDev: nodeEnv !== 'production',
  webAppUrl: optional('WEB_APP_URL', 'http://localhost:5173'),

  supabaseUrl: required('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
  // Faqat SECRET kalit: publishable/anon kalitga qaytilmaydi — u bilan RLS
  // chetlab o'tilmaydi va login tizimi xavfsiz ishlay olmaydi.
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  storageBucket: optional('SUPABASE_STORAGE_BUCKET', 'carvision'),

  paymentsMode,

  aiProvider: optional('AI_PROVIDER', 'mock') as 'mock' | 'gemini' | 'openai',
  geminiApiKey: optional('GEMINI_API_KEY'),
  geminiModel: optional('GEMINI_IMAGE_MODEL', 'gemini-3-pro-image-preview'),
  openaiApiKey: optional('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
};

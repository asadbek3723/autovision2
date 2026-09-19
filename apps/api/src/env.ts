import { config } from 'dotenv';
import { resolve } from 'node:path';

// Monorepo ildizidagi .env fayli barcha workspace'lar uchun umumiy
config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

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
  /** WEB_APP_URL vergul bilan bir nechta manzil bo'lishi mumkin (masalan, asosiy domen + preview) */
  webAppUrls: optional('WEB_APP_URL', 'http://localhost:5173')
    .split(',')
    .map((u) => u.trim().replace(/\/+$/, ''))
    .filter(Boolean),

  supabaseUrl: optional('SUPABASE_URL', optional('NEXT_PUBLIC_SUPABASE_URL', '')),
  // Faqat SECRET kalit: publishable/anon kalitga qaytilmaydi — u bilan RLS
  // chetlab o'tilmaydi va login tizimi xavfsiz ishlay olmaydi.
  supabaseServiceKey: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
  storageBucket: optional('SUPABASE_STORAGE_BUCKET', 'carvision'),

  paymentsMode,

  aiProvider: optional('AI_PROVIDER', 'mock') as 'mock' | 'gemini' | 'openai',
  geminiApiKey: optional('GEMINI_API_KEY'),
  /** Google'ning o'zi yoki Gemini-mos gateway (masalan https://api2.laozhang.ai) */
  geminiBaseUrl: (optional('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, ''),
  geminiModel: optional('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image'),
  openaiApiKey: optional('OPENAI_API_KEY'),
  openaiModel: optional('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
};


export interface ConfigProblem {
  /** blocking — server ishlay olmaydi; warning — ishlaydi, lekin xavfli/noto'g'ri */
  level: 'blocking' | 'warning';
  code: string;
  message: string;
}

/**
 * Sozlamalar tekshiruvi. Qiymatlar hech qachon qaytarilmaydi — faqat o'zgaruvchi
 * nomlari va muammo turi (Vercel loglari va /health uchun xavfsiz).
 */
export function configProblems(): ConfigProblem[] {
  const out: ConfigProblem[] = [];

  if (!env.supabaseUrl) {
    out.push({ level: 'blocking', code: 'missing_supabase_url', message: 'SUPABASE_URL sozlanmagan' });
  } else if (!/^https:\/\/.+\.supabase\.(co|in)\/?$/.test(env.supabaseUrl)) {
    out.push({ level: 'warning', code: 'odd_supabase_url', message: 'SUPABASE_URL odatdagi Supabase manziliga o‘xshamaydi' });
  }

  if (!env.supabaseServiceKey) {
    out.push({
      level: 'blocking',
      code: 'missing_service_key',
      message: 'SUPABASE_SERVICE_ROLE_KEY sozlanmagan (Supabase > Project Settings > API Keys > Secret key)',
    });
  } else if (env.supabaseServiceKey.startsWith('sb_publishable_')) {
    out.push({
      level: 'warning',
      code: 'service_key_is_publishable',
      message:
        'SUPABASE_SERVICE_ROLE_KEY ga publishable (anon) kalit qo‘yilgan — bu xavfsiz emas. Secret kalitni (sb_secret_...) qo‘ying.',
    });
  }

  if (env.aiProvider === 'gemini' && !env.geminiApiKey) {
    out.push({ level: 'warning', code: 'missing_gemini_key', message: 'AI_PROVIDER=gemini, lekin GEMINI_API_KEY yo‘q' });
  }
  if (env.aiProvider === 'openai' && !env.openaiApiKey) {
    out.push({ level: 'warning', code: 'missing_openai_key', message: 'AI_PROVIDER=openai, lekin OPENAI_API_KEY yo‘q' });
  }

  if (!env.isDev && env.webAppUrls.some((u) => u.startsWith('http://localhost'))) {
    out.push({
      level: 'warning',
      code: 'web_app_url_localhost',
      message: 'WEB_APP_URL production’da localhost’ga qaratilgan — brauzer so‘rovlari CORS bilan bloklanadi',
    });
  }

  return out;
}

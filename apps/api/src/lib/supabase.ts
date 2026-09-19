import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';

/**
 * Service role klienti — RLS'ni chetlab o'tadi.
 * Faqat serverda ishlatiladi; bu kalit hech qachon frontendga chiqmaydi.
 */
export const db = createClient(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseServiceKey || 'placeholder-service-key-for-init',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Rasmni Storage'ga yuklab, public URL qaytaradi */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  prefix: string
): Promise<string> {
  const ext = EXT_BY_MIME[mimeType] ?? 'jpg';
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  try {
    const { error } = await db.storage.from(env.storageBucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (!error) {
      const { data } = db.storage.from(env.storageBucket).getPublicUrl(path);
      return data.publicUrl;
    }
    console.warn(`Storage upload ogohlantirishi: ${error.message}. Base64 fallback ishlatilmoqda.`);
  } catch (err: any) {
    console.warn(`Storage yuklash xatosi: ${err?.message || err}`);
  }

  // Fallback: Data URL
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/** Bucket mavjudligini ta'minlaydi (birinchi ishga tushirishda) */
export async function ensureBucket(): Promise<void> {
  try {
    const { data } = await db.storage.getBucket(env.storageBucket);
    if (data) return;
    const { error } = await db.storage.createBucket(env.storageBucket, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !error.message.includes('already exists')) {
      console.warn(`Storage bucket yaratish ogohlantirishi: ${error.message}`);
    }
  } catch (err: any) {
    console.warn(`Storage bucket tekshirishda ogohlantirish: ${err?.message || err}`);
  }
}

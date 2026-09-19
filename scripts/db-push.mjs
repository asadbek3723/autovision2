#!/usr/bin/env node
/**
 * supabase/schema.sql ni Supabase'ga qo'llaydi — bu loyihaning yagona sxema
 * manbai (jadvallar, RLS, storage bucket, demo ma'lumotlar bitta faylda).
 *
 * DATABASE_URL berilgan bo'lsa `pg` paketi orqali to'g'ridan-to'g'ri ishga
 * tushiradi (alohida psql o'rnatish shart emas). Aks holda faylni
 * ko'rsatib, Supabase SQL Editor'ga qo'lda joylashtirish yo'riqnomasini beradi.
 *
 * Foydalanish:
 *   npm run db:push
 *   (DATABASE_URL: Supabase > Project Settings > Database > Connection string > URI)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });

const schemaFile = join(root, 'supabase', 'schema.sql');
const sql = readFileSync(schemaFile, 'utf8');

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Sxema, RLS va demo maʼlumotlar muvaffaqiyatli qoʻllandi.');
    process.exit(0);
  } catch (err) {
    console.error('\nSQL bajarishda xato:\n');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

console.log(`DATABASE_URL topilmadi. SQL fayl: ${schemaFile}\n`);
console.log('Qoʻllash yoʻllari:');
console.log('  1) Supabase Dashboard > SQL Editor > shu faylni joylashtiring va Run bosing.');
console.log('  2) DATABASE_URL ni .env ga qoʻshib, qaytadan ishga tushiring: npm run db:push');
console.log('     (Supabase > Project Settings > Database > Connection string > URI, Transaction pooler emas)');

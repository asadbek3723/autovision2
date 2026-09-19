#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env') });

const databaseUrl = process.env.DATABASE_URL;
const migrationsDir = join(root, 'supabase', 'migrations');

if (!databaseUrl) {
  console.log('DATABASE_URL topilmadi.');
  console.log('Migratsiyalarni bajarish uchun .env fayliga DATABASE_URL ni yozing yoki SQL Editor orqali qoʻlda bajaring.');
  console.log(`Migratsiyalar papkasi: ${migrationsDir}`);
  process.exit(0);
}

const { Client } = await import('pg');
const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    console.log(`Migratsiya qoʻllanmoqda: ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await client.query(sql);
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    console.log(`✅ ${file} muvaffaqiyatli bajarildi.`);
    count++;
  }

  if (count === 0) {
    console.log('Barcha migratsiyalar allaqachon qoʻllangan (0 ta yangi migratsiya).');
  } else {
    console.log(`\nJami ${count} ta migratsiya qoʻllandi.`);
  }

  process.exit(0);
} catch (err) {
  console.error('\nMigratsiyada xato:\n');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

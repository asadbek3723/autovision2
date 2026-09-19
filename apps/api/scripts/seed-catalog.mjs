/**
 * Katalogni yangilash:
 *  1. images/ dagi xom rasmlardan fon-siz mahsulot rasmlarini yasaydi (images/products/*.webp)
 *  2. Ularni Supabase Storage'ga yuklaydi
 *  3. Rasmsiz (chala) mahsulotlarni o'chiradi va yangi mahsulotlarni qo'shadi
 *
 * Ishga tushirish: node apps/api/scripts/seed-catalog.mjs [--dry]
 * Qayta ishga tushirsa xato bermaydi (bir xil nomli mahsulot almashtiriladi).
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRODUCTS, buildProductImage } from './catalog-products.mjs';

config({ path: new URL('../../../.env', import.meta.url) });

const DRY = process.argv.includes('--dry');
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'carvision';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const fail = (msg, err) => {
  console.error(`✗ ${msg}${err ? ': ' + (err.message ?? err) : ''}`);
  process.exit(1);
};

/* ------------------------------------------------------------- 1. rasmlar */
const outDir = new URL('../../../images/products/', import.meta.url);
await mkdir(outDir, { recursive: true });
const images = new Map();
for (const p of PRODUCTS) {
  const buf = await buildProductImage(p);
  await writeFile(new URL(`${p.slug}.webp`, outDir), buf);
  images.set(p.slug, buf);
  console.log(`✓ rasm tayyor: ${p.slug} (${Math.round(buf.length / 1024)} KB)`);
}
if (DRY) {
  console.log('--dry: bazaga tegilmadi');
  process.exit(0);
}

/* --------------------------------------------------------------- 2. storage */
{
  const { data } = await db.storage.getBucket(bucket);
  if (!data) {
    const { error } = await db.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error) fail('bucket yaratilmadi', error);
  }
}
const urls = new Map();
for (const p of PRODUCTS) {
  const path = `products/${p.slug}.webp`;
  const { error } = await db.storage
    .from(bucket)
    .upload(path, images.get(p.slug), { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
  if (error) fail(`yuklanmadi: ${path}`, error);
  urls.set(p.slug, db.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  console.log(`✓ yuklandi: ${urls.get(p.slug)}`);
}

/* ------------------------------------------------------------ 3. kategoriya */
const { data: cats, error: catErr } = await db.from('categories').select('id, slug, sort_order');
if (catErr) fail('kategoriyalar o‘qilmadi', catErr);
if (!cats.some((c) => c.slug === 'grille')) {
  const { error } = await db
    .from('categories')
    .insert({ slug: 'grille', name: 'Oldi panjara (rishotka)', sort_order: 4 });
  if (error) fail('grille kategoriyasi qo‘shilmadi', error);
  console.log('✓ kategoriya qo‘shildi: grille');
}
const { data: allCats } = await db.from('categories').select('id, slug');
const catId = Object.fromEntries(allCats.map((c) => [c.slug, c.id]));

/* --------------------------------------------------------- 4. mahsulotlar */
const { data: existing, error: exErr } = await db.from('products').select('*');
if (exErr) fail('mahsulotlar o‘qilmadi', exErr);

// Zaxira nusxa (qaytarish kerak bo'lsa)
const backupDir = join(tmpdir(), 'carvision-backup');
await mkdir(backupDir, { recursive: true });
const backupFile = join(backupDir, `products-${Date.now()}.json`);
await writeFile(backupFile, JSON.stringify(existing, null, 2));
console.log(`✓ zaxira nusxa: ${backupFile} (${existing.length} ta mahsulot)`);

// Buyurtma/savatga bog'langan mahsulotni o'chirib bo'lmaydi (order_items -> restrict)
const incomplete = existing.filter((p) => !p.image_url);
const ours = new Set(PRODUCTS.map((p) => p.name));
const toDelete = existing.filter((p) => !p.image_url || ours.has(p.name)).map((p) => p.id);
if (toDelete.length) {
  const { error } = await db.from('products').delete().in('id', toDelete);
  if (error) fail('eski mahsulotlar o‘chirilmadi', error);
  console.log(`✓ o‘chirildi: ${toDelete.length} ta (shundan rasmsizlari: ${incomplete.length})`);
}

// Sotuvchi: eski mahsulotlari eng ko'p bo'lgan, aks holda birinchisi
const { data: sellers } = await db.from('sellers').select('id, business_name').order('created_at');
if (!sellers?.length) fail('sotuvchi topilmadi (avval sotuvchi akkaunt yarating)');
const counts = {};
for (const p of existing) counts[p.seller_id] = (counts[p.seller_id] ?? 0) + 1;
const seller = [...sellers].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))[0];
console.log(`✓ sotuvchi: ${seller.business_name}`);

const { data: gentra } = await db
  .from('vehicle_models')
  .select('id')
  .ilike('model', 'gentra')
  .limit(1)
  .maybeSingle();

for (const p of PRODUCTS) {
  if (!catId[p.category]) fail(`kategoriya topilmadi: ${p.category}`);
  const { data: row, error } = await db
    .from('products')
    .insert({
      seller_id: seller.id,
      category_id: catId[p.category],
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      brand: p.brand,
      image_url: urls.get(p.slug),
      installation_available: true,
      installation_price: p.installation_price,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) fail(`mahsulot qo‘shilmadi: ${p.name}`, error);
  if (gentra) {
    await db.from('product_compatibility').insert({ product_id: row.id, vehicle_model_id: gentra.id });
  }
  console.log(`✓ mahsulot: ${p.name} → ${row.id}`);
}

const { count } = await db.from('products').select('*', { count: 'exact', head: true });
console.log(`\nTayyor. Katalogda hozir ${count} ta mahsulot.`);

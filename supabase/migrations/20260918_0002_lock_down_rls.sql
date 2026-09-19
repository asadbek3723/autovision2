-- CarVision — xavfsizlik: ochiq RLS siyosatlarini yopish
--
-- MUAMMO: 0001 migratsiyasi users / sessions / login_attempts jadvallariga
-- "for all using (true) with check (true)" siyosatini qo'ygan edi. Bu jadvallar
-- publishable (anon) kalit bilan to'liq o'qiladi va YOZILADI: parol xeshlari,
-- sessiya token xeshlari ochiq, va hujumchi o'ziga sessiya yozib istalgan
-- foydalanuvchi nomidan kira oladi.
--
-- OLDIN: backend .env dagi SUPABASE_SERVICE_ROLE_KEY ga Supabase'ning SECRET
-- kalitini (sb_secret_...) qo'ying. Backend faqat shu kalit bilan RLS'ni
-- chetlab o'tadi. Kalit publishable bo'lsa, bu migratsiyadan keyin login ishlamaydi.
--   Supabase Dashboard > Project Settings > API Keys > "Secret keys"
--
-- Fayl qayta-qayta ishga tushirilsa ham xato bermaydi.
begin;

-- 1. Ochiq siyosatlarni olib tashlash
drop policy if exists "users public all"          on users;
drop policy if exists "sessions public all"       on sessions;
drop policy if exists "login_attempts public all" on login_attempts;
drop policy if exists "sellers public read"       on sellers;

-- 2. RLS yoqilgan bo'lsin; siyosatsiz jadval anon/authenticated uchun yopiq
alter table users                      enable row level security;
alter table sessions                   enable row level security;
alter table login_attempts             enable row level security;
alter table sellers                    enable row level security;
alter table cars                       enable row level security;
alter table car_photos                 enable row level security;
alter table generations                enable row level security;
alter table carts                      enable row level security;
alter table cart_items                 enable row level security;
alter table orders                     enable row level security;
alter table order_items                enable row level security;
alter table seller_credit_transactions enable row level security;
alter table seller_generations         enable row level security;

-- 3. Qo'shimcha qatlam: grant'larni ham olib tashlash
revoke all on users, sessions, login_attempts, sellers from anon, authenticated;

-- 4. Sotuvchining ommaviy ma'lumoti faqat view orqali (credits, user_id yo'q)
create or replace view public_sellers with (security_invoker = false) as
  select id, business_name, verified, phone from sellers;
grant select on public_sellers to anon, authenticated;

commit;

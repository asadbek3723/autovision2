-- ============================================================================
--  CarVision — to'liq baza sxemasi va demo ma'lumotlar
--  Supabase > SQL Editor ga to'liq joylashtiring va Run bosing.
--
--  Fayl idempotent: qayta-qayta ishga tushirsangiz ham xato bermaydi.
--  Har safar CarVision jadvallarini qaytadan quradi va demo ma'lumotlarni
--  to'ldiradi. Boshqa sxemalarga (auth, storage konfiguratsiyasi) tegmaydi.
--
--  Ichida: extension'lar, enum'lar, 14 ta jadval, indekslar, RLS siyosatlari,
--  storage bucket, avtomatik trigger'lar va demo katalog.
-- ============================================================================

begin;

-- ----------------------------------------------------------------- 0. Extensions
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------ 1. Eski obyektlar
-- Bog'liqlik tartibida tozalash — qayta ishga tushirishni xatosiz qiladi.
drop function if exists checkout_cart(uuid, text, text);
drop table if exists seller_generations       cascade;
drop table if exists seller_credit_transactions cascade;
drop table if exists order_items        cascade;
drop table if exists orders             cascade;
drop table if exists cart_items         cascade;
drop table if exists carts              cascade;
drop table if exists cart               cascade;  -- eski nom (0001 migratsiyasi)
drop table if exists generation_images  cascade;  -- eski, endi generations ustunlariga birlashtirilgan
drop table if exists generations        cascade;
drop table if exists car_photos         cascade;
drop table if exists cars               cascade;
drop table if exists product_compatibility cascade;
drop table if exists products           cascade;
drop table if exists vehicle_models     cascade;
drop table if exists categories         cascade;
drop table if exists sellers            cascade;
drop table if exists users              cascade;

drop type if exists user_role        cascade;
drop type if exists order_status     cascade;
drop type if exists generation_status cascade;

-- --------------------------------------------------------------------- 2. Enums
create type user_role         as enum ('user', 'seller', 'admin');
create type order_status      as enum ('new', 'accepted', 'installing', 'completed', 'cancelled');
create type generation_status as enum ('pending', 'processing', 'done', 'failed');

-- ------------------------------------------------------ 3. updated_at trigger
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------- 4. users
create table users (
  id          uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  name        text,
  username    text,
  phone       text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

comment on table users is 'Telegram foydalanuvchilari; telegram_id — yagona identifikator';

-- ----------------------------------------------------------------- 5. sellers
create table sellers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  business_name text not null,
  description   text,
  phone         text,
  address       text,
  verified      boolean not null default false,
  -- AI mahsulot rasmi generatsiyasi uchun kredit balansi (1 generatsiya = 1 kredit)
  credits       int not null default 3 check (credits >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

create trigger sellers_updated_at before update on sellers
  for each row execute function set_updated_at();

-- -------------------------------------------------------------- 6. categories
-- Kuzov qismlari bo'yicha taqsimot — packages/shared/customization.ts bilan bir xil
create table categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  icon       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------- 7. vehicle_models
create table vehicle_models (
  id         uuid primary key default gen_random_uuid(),
  brand      text not null,
  model      text not null,
  year_from  int,
  year_to    int,
  body_type  text,
  created_at timestamptz not null default now(),
  unique (brand, model)
);

create index vehicle_models_brand_idx on vehicle_models (brand);

-- ---------------------------------------------------------------- 8. products
create table products (
  id                     uuid primary key default gen_random_uuid(),
  seller_id              uuid not null references sellers(id) on delete cascade,
  category_id            uuid not null references categories(id) on delete restrict,
  name                   text not null,
  description            text,
  price                  numeric(12, 2) not null check (price >= 0),
  image_url              text,
  stock                  int not null default 0 check (stock >= 0),
  brand                  text,
  installation_available boolean not null default false,
  installation_price     numeric(12, 2) check (installation_price >= 0),
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index products_category_idx on products (category_id);
create index products_seller_idx   on products (seller_id);
create index products_active_idx   on products (is_active) where is_active;

create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ------------------------------------------------- 9. product_compatibility
-- Mahsulot uchun moslik yozuvi bo'lmasa — universal deb hisoblanadi.
create table product_compatibility (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id) on delete cascade,
  vehicle_model_id uuid not null references vehicle_models(id) on delete cascade,
  unique (product_id, vehicle_model_id)
);

create index product_compat_model_idx on product_compatibility (vehicle_model_id);

-- -------------------------------------------------------------------- 10. cars
-- Brend/model/rang AI tomonidan aniqlanadi, foydalanuvchi tasdiqlaydi.
create table cars (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  vehicle_model_id     uuid references vehicle_models(id) on delete set null,
  image_url            text,
  detected_brand       text,
  detected_model       text,
  detected_color       text,
  detected_year        int,
  detection_confidence numeric(4, 3) check (detection_confidence between 0 and 1),
  confirmed            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index cars_user_idx on cars (user_id, created_at desc);

create trigger cars_updated_at before update on cars
  for each row execute function set_updated_at();

comment on column cars.confirmed is 'Foydalanuvchi AI aniqlagan model/rangni tasdiqladimi';

-- -------------------------------------------------------------- 11. car_photos
-- 8 ta majburiy rakurs (45° qadam) + 2 ta ixtiyoriy yaqin kadr.
create table car_photos (
  id         uuid primary key default gen_random_uuid(),
  car_id     uuid not null references cars(id) on delete cascade,
  image_url  text not null,
  angle      text not null check (angle in (
    'front', 'front-left', 'left', 'rear-left',
    'rear', 'rear-right', 'right', 'front-right',
    'wheel', 'interior'
  )),
  width      int,
  height     int,
  created_at timestamptz not null default now(),
  unique (car_id, angle)
);

create index car_photos_car_idx on car_photos (car_id, created_at);

-- ------------------------------------------------------------- 12. generations
-- Bitta konfiguratsiya (tanlangan qismlar) — bir nechta rakurs uchun.
create table generations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  car_id          uuid not null references cars(id) on delete cascade,
  original_image  text not null,
  generated_image text,
  prompt          text not null,
  options         jsonb not null default '{}'::jsonb,
  categories      text[] not null default '{}',
  status          generation_status not null default 'pending',
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index generations_user_idx on generations (user_id, created_at desc);
create index generations_car_idx  on generations (car_id);

create trigger generations_updated_at before update on generations
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------- 14. carts
create table carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity   int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create index cart_items_cart_idx on cart_items (cart_id);

-- ------------------------------------------------------------------ 15. orders
create table orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  seller_id  uuid not null references sellers(id) on delete restrict,
  total      numeric(12, 2) not null check (total >= 0),
  status     order_status not null default 'new',
  phone      text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx   on orders (user_id, created_at desc);
create index orders_seller_idx on orders (seller_id, created_at desc);

create trigger orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  product_id        uuid not null references products(id) on delete restrict,
  quantity          int not null check (quantity > 0),
  price             numeric(12, 2) not null check (price >= 0),
  product_name      text not null,
  product_image_url text
);

create index order_items_order_idx on order_items (order_id);

-- ------------------------------------------------- 15b. checkout_cart funksiyasi
-- Savatni bir nechta sotuvchiga bo'lib order'larga aylantiradi. Bitta tranzaksiya
-- ichida ishlaydi (Postgres funksiyasi) — shu bilan ombor kamayishi va order
-- yaratish atomik bo'ladi: parallel ikkita buyurtma bir xil oxirgi donani ikki
-- marta sota olmaydi, va yarim bajarilgan (order bor-u item yo'q) holat bo'lmaydi.
create or replace function checkout_cart(p_user_id uuid, p_phone text, p_note text)
returns table (order_id uuid)
language plpgsql
as $$
declare
  v_cart_id   uuid;
  v_seller_id uuid;
  v_new_order uuid;
  v_total     numeric(12, 2);
  v_created   uuid[] := '{}';
begin
  select id into v_cart_id from carts where user_id = p_user_id;
  if v_cart_id is null or not exists (select 1 from cart_items where cart_id = v_cart_id) then
    raise exception 'EMPTY_CART';
  end if;

  -- Savatdagi mahsulotlarni qatorma-qator qulflaymiz — shu bilan boshqa
  -- parallel checkout shu mahsulotlar bo'yicha kutib turadi (oversell yo'q).
  perform 1
  from products p
  where p.id in (select ci.product_id from cart_items ci where ci.cart_id = v_cart_id)
  for update;

  if exists (
    select 1
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id and p.stock < ci.quantity
  ) then
    raise exception 'OUT_OF_STOCK';
  end if;

  for v_seller_id in
    select distinct p.seller_id
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
  loop
    select coalesce(sum(p.price * ci.quantity), 0) into v_total
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id and p.seller_id = v_seller_id;

    insert into orders (user_id, seller_id, total, status, phone, note)
    values (p_user_id, v_seller_id, v_total, 'new', p_phone, p_note)
    returning id into v_new_order;

    v_created := array_append(v_created, v_new_order);

    insert into order_items (order_id, product_id, quantity, price, product_name, product_image_url)
    select v_new_order, p.id, ci.quantity, p.price, p.name, p.image_url
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id and p.seller_id = v_seller_id;

    update products p
    set stock = p.stock - ci.quantity
    from cart_items ci
    where ci.cart_id = v_cart_id and ci.product_id = p.id and p.seller_id = v_seller_id;
  end loop;

  delete from cart_items where cart_id = v_cart_id;

  return query select unnest(v_created);
end;
$$;

-- ------------------------------------------------- 15c. seller_credit_transactions
-- Sotib olish (musbat) va AI generatsiyada sarflash (manfiy) tarixi.
create table seller_credit_transactions (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references sellers(id) on delete cascade,
  type       text not null check (type in ('purchase', 'consume')),
  amount     int not null,
  package_id text,
  created_at timestamptz not null default now()
);

create index seller_credit_tx_seller_idx on seller_credit_transactions (seller_id, created_at desc);

-- ------------------------------------------------------- 15d. seller_generations
-- Sotuvchi o'z mahsulotini namoyish qilish uchun AI bilan yaratgan rasm.
-- Mijozning Studio oqimidan (generations jadvali) mustaqil.
create table seller_generations (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references sellers(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  base_image    text not null,
  prompt        text not null,
  result_image  text,
  status        generation_status not null default 'pending',
  error         text,
  created_at    timestamptz not null default now()
);

create index seller_generations_seller_idx on seller_generations (seller_id, created_at desc);

-- ================================================================== 16. Storage
-- Rasm bucket'i. Backend service_role bilan yozadi, o'qish ochiq.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carvision', 'carvision', true, 12582912,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects egaligi cheklangan loyihalarda siyosat yaratish xato berishi
-- mumkin — butun skript to'xtab qolmasligi uchun himoyalangan blokda bajariladi.
do $$
begin
  drop policy if exists "carvision public read"   on storage.objects;
  drop policy if exists "carvision public insert" on storage.objects;
  drop policy if exists "carvision public update" on storage.objects;

  create policy "carvision public read"   on storage.objects for select using (bucket_id = 'carvision');
  create policy "carvision public insert" on storage.objects for insert with check (bucket_id = 'carvision');
  create policy "carvision public update" on storage.objects for update using (bucket_id = 'carvision');
exception when insufficient_privilege or undefined_table then
  raise notice 'storage.objects siyosati o''tkazib yuborildi: Dashboard > Storage > Policies dan qo''lda qo''shing';
end;
$$;

-- ====================================================================== 17. RLS
-- Anon/publishable kaliti yoki service_role bilan ishlaganda ham RLS xatolari bo'lmasligi
-- uchun barcha jadvallar uchun ochiq siyosatlar:

alter table users                 enable row level security;
alter table sellers               enable row level security;
alter table categories            enable row level security;
alter table vehicle_models        enable row level security;
alter table products              enable row level security;
alter table product_compatibility enable row level security;
alter table cars                  enable row level security;
alter table car_photos            enable row level security;
alter table generations           enable row level security;
alter table carts                 enable row level security;
alter table cart_items            enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table seller_credit_transactions enable row level security;
alter table seller_generations         enable row level security;

-- Ochiq katalog va amallar
create policy "categories public all"     on categories            for all using (true) with check (true);
create policy "vehicle_models public all" on vehicle_models        for all using (true) with check (true);
create policy "products public all"       on products              for all using (true) with check (true);
create policy "compat public all"         on product_compatibility for all using (true) with check (true);
create policy "sellers public all"        on sellers               for all using (true) with check (true);
create policy "users public all"          on users                 for all using (true) with check (true);
create policy "cars public all"           on cars                  for all using (true) with check (true);
create policy "car_photos public all"     on car_photos            for all using (true) with check (true);
create policy "generations public all"    on generations           for all using (true) with check (true);
create policy "carts public all"          on carts                 for all using (true) with check (true);
create policy "cart_items public all"     on cart_items            for all using (true) with check (true);
create policy "orders public all"         on orders                for all using (true) with check (true);
create policy "order_items public all"    on order_items           for all using (true) with check (true);
create policy "seller_credit_tx all"      on seller_credit_transactions for all using (true) with check (true);
create policy "seller_generations all"    on seller_generations    for all using (true) with check (true);

-- ============================================================ 18. Demo ma'lumotlar

-- ------------------------------------------------------------------ Kategoriyalar
insert into categories (slug, name, sort_order) values
  ('front-bumper',  'Oldi bamper',    10),
  ('rear-bumper',   'Orqa bamper',    20),
  ('fenders',       'Yon qanotlar',   30),
  ('windows',       'Oynalar',        40),
  ('wheels',        'Disklar',        50),
  ('tires',         'Shinalar',       60),
  ('spoilers',      'Spoyler',        70),
  ('headlights',    'Faralar',        80),
  ('taillights',    'Orqa chiroqlar', 90),
  ('paint',         'Rang / wrap',   100),
  ('interior',      'Salon',         110),
  ('detailing',     'Detailing',     120),
  ('accessories',   'Aksessuarlar',  130);

-- --------------------------------------------------------------- Avtomobil modellari
-- AI aniqlagan model bazada topilishi uchun O'zbekistondagi keng tarqalgan mashinalar.
insert into vehicle_models (brand, model, year_from, year_to, body_type) values
  ('Chevrolet', 'Cobalt',   2012, 2026, 'sedan'),
  ('Chevrolet', 'Gentra',   2013, 2026, 'sedan'),
  ('Chevrolet', 'Nexia 3',  2015, 2026, 'sedan'),
  ('Chevrolet', 'Lacetti',  2004, 2015, 'sedan'),
  ('Chevrolet', 'Malibu',   2016, 2026, 'sedan'),
  ('Chevrolet', 'Spark',    2010, 2022, 'hatchback'),
  ('Chevrolet', 'Tracker',  2019, 2026, 'suv'),
  ('Chevrolet', 'Captiva',  2011, 2026, 'suv'),
  ('Chevrolet', 'Onix',     2019, 2026, 'sedan'),
  ('Chevrolet', 'Damas',    2008, 2026, 'van'),
  ('Chevrolet', 'Equinox',  2018, 2026, 'suv'),
  ('Kia',       'K5',       2019, 2026, 'sedan'),
  ('Kia',       'Sportage', 2016, 2026, 'suv'),
  ('Kia',       'Cerato',   2018, 2026, 'sedan'),
  ('Hyundai',   'Sonata',   2015, 2026, 'sedan'),
  ('Hyundai',   'Elantra',  2016, 2026, 'sedan'),
  ('Hyundai',   'Tucson',   2018, 2026, 'suv'),
  ('Toyota',    'Camry',    2015, 2026, 'sedan'),
  ('Toyota',    'Corolla',  2014, 2026, 'sedan'),
  ('Toyota',    'RAV4',     2016, 2026, 'suv'),
  ('BYD',       'Chazor',   2023, 2026, 'sedan'),
  ('BYD',       'Song Plus',2022, 2026, 'suv');

-- ------------------------------------------------------------------ Sotuvchilar
insert into users (telegram_id, name, phone, role) values
  (100000001, 'Sardor Tuning',  '+998901234567', 'seller'),
  (100000002, 'Autoline Parts', '+998907654321', 'seller');

insert into sellers (user_id, business_name, description, phone, address, verified)
select id,
       'Sardor Tuning Garage',
       'Toshkentdagi tuning va detailing studiyasi. Bamper, qanot va wrap bo''yicha ixtisoslashgan.',
       '+998901234567',
       'Toshkent, Chilonzor tumani',
       true
from users where telegram_id = 100000001;

insert into sellers (user_id, business_name, description, phone, address, verified)
select id,
       'Autoline Parts',
       'Original va aftermarket ehtiyot qismlar do''koni. Rasmiy kafolat bilan.',
       '+998907654321',
       'Toshkent, Yunusobod tumani',
       true
from users where telegram_id = 100000002;

-- -------------------------------------------------------------------- Mahsulotlar
insert into products (seller_id, category_id, name, description, price, stock, brand,
                      installation_available, installation_price)
select
  (select id from sellers
    where business_name = case when p.seller_key = 'tuning'
                               then 'Sardor Tuning Garage' else 'Autoline Parts' end),
  (select id from categories where categories.slug = p.cat),
  p.name, p.descr, p.price, p.stock, p.brand, p.install, p.install_price
from (values
  -- Oldi bamper
  ('tuning', 'front-bumper', 'Oldi lip splitter',        'ABS plastik lip, kuzov rangiga bo''yalgan holda yetkaziladi.',        1400000,  6, 'CV Aero',        true,  400000),
  ('tuning', 'front-bumper', 'Sport oldi bamper',        'Kengaytirilgan havo olish teshiklari bilan sport bamper.',            3900000,  3, 'CV Aero',        true,  900000),
  ('tuning', 'front-bumper', 'Karbon oldi lip',          'Haqiqiy karbon tolali oldi lip, lak qoplamali.',                      2450000,  4, 'Carbonix',       true,  400000),
  ('parts',  'front-bumper', 'Oldi bamper panjarasi',    'Mat qora panjara, zavod o''rniga o''rnatiladi.',                       890000,  9, 'Autoline',       true,  200000),
  -- Orqa bamper
  ('tuning', 'rear-bumper',  'Orqa diffuzor',            'Orqa bamper ostiga o''rnatiladigan diffuzor.',                        1650000,  5, 'CV Aero',        true,  450000),
  ('tuning', 'rear-bumper',  'Sport orqa bamper',        'Diffuzor integratsiya qilingan sport orqa bamper.',                   4200000,  2, 'CV Aero',        true,  950000),
  ('tuning', 'rear-bumper',  'Karbon orqa diffuzor',     'Karbon tolali diffuzor, uchta qovurg''ali.',                          2750000,  3, 'Carbonix',       true,  450000),
  -- Yon qanotlar
  ('tuning', 'fenders',      'Yon skirt to''plami',       'Yon eshik ostiga o''rnatiladigan skirt, juftlik.',                    1750000,  5, 'CV Aero',        true,  450000),
  ('tuning', 'fenders',      'Widebody qanot kengaytmasi','G''ildirak kamarlarini kengaytiruvchi to''plam.',                     5300000,  2, 'CV Aero',        true, 1400000),
  -- Oynalar
  ('parts',  'windows',      'Ceramic tonirovka 20%',    'Issiqlikni qaytaruvchi ceramic plyonka, butun mashina uchun.',        1200000, 25, 'LLumar',         true,       0),
  ('parts',  'windows',      'Ceramic tonirovka 5%',     'To''q ceramic plyonka. O''rnatish narxga kiritilgan.',                1350000, 18, 'LLumar',         true,       0),
  ('parts',  'windows',      'Oyna deflektorlari',       'Yon oynalar uchun shamol deflektorlari, 4 dona.',                      420000, 22, 'Autoline',       true,  100000),
  -- Disklar
  ('tuning', 'wheels',       'R16 Sport Matte Black disk','Yengil qotishmali 5x105 disk, mat qora qoplama. To''plam — 4 dona.', 3200000,  8, 'Vossen Replica', true,  250000),
  ('tuning', 'wheels',       'R17 Bronze Forged disk',   'Forged bronza disk 5x105. Sport ko''rinish, yengil vazn.',            5400000,  4, 'Rota',           true,  300000),
  ('parts',  'wheels',       'R15 OEM+ Silver disk',     'Zavod o''lchamiga mos kumush disk, kundalik foydalanish uchun.',      2100000, 12, 'Aleks Wheels',   true,  200000),
  ('tuning', 'wheels',       'R17 Deep Dish disk',       'Concave profil, polished lip.',                                      6100000,  3, 'Work Replica',   true,  300000),
  -- Shinalar
  ('parts',  'tires',        '195/60 R15 yozgi shina',   'Yozgi shina, past shovqin darajasi. 1 dona narxi.',                    680000, 20, 'Nexen',          true,   60000),
  ('parts',  'tires',        '205/50 R17 sport shina',   'Past profil sport shina, yuqori tutish. 1 dona narxi.',               1150000, 14, 'Michelin',       true,   60000),
  -- Spoyler
  ('tuning', 'spoilers',     'Ducktail spoyler',         'Bagaj qopqog''iga o''rnatiladi, kuzov rangiga bo''yaladi.',            980000,  9, 'CV Aero',        true,  250000),
  ('tuning', 'spoilers',     'Karbon lip spoyler',       'Haqiqiy karbon tolali lip spoyler, lak qoplamali.',                   1850000,  4, 'Carbonix',       true,  250000),
  ('parts',  'spoilers',     'GT wing',                  'Alyuminiy tayanchli sport GT wing, balandligi sozlanadi.',           2650000,  3, 'APR Replica',    true,  350000),
  -- Faralar
  ('parts',  'headlights',   'LED far to''plami',         'Oq LED far, DRL chizig''i bilan. Juftlik.',                          2900000,  7, 'Depo',           true,  400000),
  ('tuning', 'headlights',   'Smoked far korpusi',       'Qoraytirilgan korpusli far, juftlik.',                                2400000,  5, 'Depo',           true,  400000),
  -- Orqa chiroqlar
  ('tuning', 'taillights',   'Smoked stop chiroq',       'Qoraytirilgan korpusli orqa chiroq, juftlik.',                        1650000,  6, 'Depo',           true,  300000),
  ('parts',  'taillights',   'LED bar stop chiroq',      'Butun kengligi bo''yicha LED chiziqli orqa chiroq.',                  3100000,  4, 'Depo',           true,  350000),
  -- Rang / wrap
  ('tuning', 'paint',        'Satin qora wrap',          'To''liq kuzov uchun satin qora vinil plyonka.',                       7800000,  5, '3M 2080',        true, 2500000),
  ('tuning', 'paint',        'Matte Nardo Grey wrap',    'To''liq kuzov uchun matte kulrang vinil plyonka.',                    8200000,  4, 'Avery Dennison', true, 2500000),
  ('tuning', 'paint',        'Gloss oq wrap',            'To''liq kuzov uchun yaltiroq marvarid oq plyonka.',                   8000000,  4, '3M 2080',        true, 2500000),
  -- Salon / detailing / aksessuar
  ('parts',  'interior',     'Alcantara rul qoplamasi',  'Alcantara qoplama, qo''lda tikilgan.',                                 890000, 15, 'CV Interior',    true,  150000),
  ('parts',  'interior',     'Karbon salon panellari',   'Salon uchun karbon ko''rinishli panel to''plami.',                    1250000,  8, 'CV Interior',    true,  300000),
  ('tuning', 'detailing',    'Ceramic coating 9H',       'Kuzov uchun 9H keramik qoplama, 2 yillik himoya.',                    3500000, 10, 'Gyeon',          true,       0),
  ('parts',  'accessories',  'Ambient LED salon yoritgichi','Salon uchun 64 rangli ambient yoritish to''plami.',                 750000, 20, 'Neon Line',      true,  350000)
) as p(seller_key, cat, name, descr, price, stock, brand, install, install_price);

-- ------------------------------------------------------------------- Moslik
-- Disk va shinalar o'lchamga bog'liq; qolgan mahsulotlar universal
-- (moslik yozuvi yo'q => barcha modellarga mos deb hisoblanadi).
insert into product_compatibility (product_id, vehicle_model_id)
select p.id, v.id
from products p
join vehicle_models v on true
where (p.name like 'R15%'    and v.model in ('Cobalt', 'Gentra', 'Nexia 3', 'Spark', 'Lacetti'))
   or (p.name like 'R16%'    and v.model in ('Cobalt', 'Gentra', 'Nexia 3', 'Onix', 'Lacetti'))
   or (p.name like 'R17%'    and v.model in ('Malibu', 'Tracker', 'Captiva', 'K5', 'Sonata', 'Camry'))
   or (p.name like '195/60%' and v.model in ('Cobalt', 'Gentra', 'Nexia 3', 'Spark', 'Lacetti'))
   or (p.name like '205/50%' and v.model in ('Malibu', 'Tracker', 'K5', 'Sonata', 'Camry'))
on conflict do nothing;

commit;

-- ============================================================================
--  Tekshiruv — quyidagi so'rov har bir jadvaldagi yozuvlar sonini ko'rsatadi.
-- ============================================================================
select 'categories'     as jadval, count(*) from categories
union all select 'vehicle_models',        count(*) from vehicle_models
union all select 'sellers',               count(*) from sellers
union all select 'products',              count(*) from products
union all select 'product_compatibility', count(*) from product_compatibility
order by 1;

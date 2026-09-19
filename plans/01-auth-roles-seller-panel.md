# CarVision — Login/Parol autentifikatsiyasi, rollar va Seller panel: to'liq reja

> Reja versiyasi: 1.0 · Sana: 2026-09-18 · Til: o'zbek (lotin)
> Bu fayl bajarish uchun tasdiqlangandan keyin loyihada `plans/01-auth-roles-seller-panel.md` sifatida saqlanadi (birinchi qadam — 0.1).

---

## 0. Context (nima uchun va nima o'zgaradi)

**Hozir:** CarVision Telegram Mini App sifatida qurilgan. Kirish Telegram `initData` (Mini App), Telegram Login Widget yoki dev rejimida soxta foydalanuvchi (`ALLOW_INSECURE_AUTH=true`, `telegram_id = 999000001`) orqali. Sotuvchi bo'lish — kirgandan keyin `/seller` sahifasida alohida "profil ochish" qadami.

**Kerak (foydalanuvchi qarori):**
1. Telegram butunlay olib tashlanadi. Faqat **login + parol**.
2. Ilovaga birinchi kirganda, agar akkaunt bo'lmasa — **Ro'yxatdan o'tish** yoki **Kirish** taklif qilinadi.
3. Ro'yxatdan o'tishda bitta tanlov: **«Avto-servis egasimisiz yoki oddiy foydalanuvchimi?»**
4. Servis egasi bo'lsa — mahsulot qo'shadigan **Seller panel**.

**Tasdiqlangan qarorlar (so'rovnoma natijasi):**
| Savol | Qaror |
| --- | --- |
| Parolni unutsa | **Hozircha tiklash yo'q.** Faqat profil ichida «Parolni almashtirish» (joriy parolni bilsa). Unutilsa — qo'lda (DB orqali) hal qilinadi. UI'da buni ochiq aytamiz. |
| Rolni keyin o'zgartirish | **Yo'q, qat'iy.** Rol ro'yxatdan o'tishda tanlanadi va o'zgarmaydi (DB trigger bilan majburlanadi). Ikkalasi kerak bo'lsa — ikkita akkaunt. |
| Mavjud baza | **Saqlab, migratsiya.** `schema.sql` (u hamma jadvalni `drop` qiladi!) ishlatilmaydi; yangi non-destructive migratsiya. Eski Telegram foydalanuvchilari parolsiz qoladi (kira olmaydi, qayta ro'yxatdan o'tadi); demo sotuvchilarga skript orqali login/parol beriladi. |

**Qo'shimcha qaror (menda, e'tiroz bo'lmasa shunday ketamiz):**
- «Login» = username (3–32 belgi). Email/telefon login sifatida ishlatilmaydi.
- Sessiya = server tomonda saqlanadigan, bekor qilinadigan **opaque token** (JWT/HMAC emas) → logout haqiqatan ishlaydi.
- Parol xeshi = Node `crypto.scrypt` (tashqi native kutubxonasiz, Vercel serverless'da ishlaydi).

---

## 1. Skaner natijalari — topilgan kamchiliklar

Skaner: loyihadagi barcha manba fayllar (`apps/api/src`, `apps/web/src`, `packages/shared/src`, `supabase/schema.sql`, `scripts/`, konfiglar). Fayl:qator havolalari joriy holatga tegishli.
Ustuvorlik: **P0** — auth o'zgarishi bilan birga shart / xavfsizlik; **P1** — shu reja doirasida tuzatiladi; **P2** — keyingi bosqich (rejada belgilangan, lekin blok emas).

### 1.1. Xavfsizlik va ma'lumot yaxlitligi

| # | P | Muammo | Joyi | Tuzatish |
| --- | --- | --- | --- | --- |
| S1 | P0 | `schema.sql` har ishga tushganda barcha jadvallarni `drop ... cascade` qiladi, README esa «idempotent» deydi. `npm run db:push` production'da **butun bazani o'chiradi**. | `supabase/schema.sql:19-41`, `scripts/db-push.mjs:33`, README:79 | Migratsiyalar tizimi (`supabase/migrations/`), `db-push` faqat kutilayotgan migratsiyalarni qo'llaydi. To'liq reset — alohida `--reset` bayrog'i + `NODE_ENV=production`da rad + tasdiq so'rovi. |
| S2 | P0 | **Bepul kredit:** `POST /api/seller/credits/purchase` to'lovsiz balansga qo'shadi. Har qanday sotuvchi tsiklda cheksiz kredit oladi → pullik Gemini/OpenAI xarajati. | `apps/api/src/routes/seller.ts:146-167` | Production'da endpoint `503 payments_not_configured` qaytaradi (`PAYMENTS_MODE=mock` faqat dev/staging). Kredit qo'shish faqat atomik RPC orqali. |
| S3 | P0 | **Kredit poygasi (race):** balans `seller.credits - 1` (o'qilgan eski qiymat) bilan yoziladi. Ikki parallel so'rov ikkalasi `5` o'qib, ikkalasi `4` yozadi → bitta bepul generatsiya. Qaytarish (refund) ham `select → +1` — xuddi shunday. Xarid ham `seller.credits + pkg.credits`. | `seller.ts:153`, `seller.ts:218-224`, `seller.ts:262-270` | Postgres funksiyalari: `consume_seller_credit`, `refund_seller_credit`, `add_seller_credits` (bitta `UPDATE ... SET credits = credits - 1 WHERE credits >= 1 RETURNING`), tranzaksiya yozuvi shu funksiya ichida. |
| S4 | P0 | Dev rejimda **hamma anonim tashrif buyuruvchi bitta «Dev Tester» foydalanuvchisi** bo'lib qoladi (`999000001`), savat/buyurtmalar umumiy. `.env`da hozir `ALLOW_INSECURE_AUTH=true`. | `apps/api/src/lib/auth.ts:63-65`, `apps/web/src/lib/api.ts:43-46`, `apps/web/src/lib/telegram.ts:46-56`, `env.ts:21-30` | Mexanizm butunlay o'chiriladi (Telegram bilan birga). |
| S5 | P0 | `SESSION_SECRET` bo'lmasa `'insecure-dev-secret-change-me'` ishlatiladi; yo'q bo'lsa bot tokenidan olinadi. Production'da bu — tokenlarni soxtalashtirish imkoni. | `env.ts:46` | Opaque token'ga o'tilgani uchun `SESSION_SECRET` kerak emas. (Agar keyin HMAC qaytsa — production'da majburiy, ≥32 bayt.) |
| S6 | P0 | Foydalanuvchi qatori API javobiga `select('*')` bilan chiqadi. Yangi `password_hash` ustuni shu yo'l bilan **mijozga oqib chiqadi** (`GET /api/me` butun `users` qatorini qaytaradi). | `apps/api/src/lib/auth.ts:54,75`, `routes/auth.ts:46-51`, `auth.ts:22-25` | Hamma joyda aniq ustunlar (`USER_COLUMNS`) + `toPublicUser()`; `password_hash` hech qachon `select` qilinmaydi (faqat login funksiyasida). Test bilan qulflanadi (5.3). |
| S7 | P0 | **Rate limit umuman yo'q** (login brute-force, ro'yxatdan o'tish spami, AI generatsiya, yuklash). Xotiradagi limiter serverless'da ishlamaydi (kod izohida ham shunday deyilgan). | `generations.ts:42-44`, `server.ts` | Bazaga asoslangan limiter (`login_attempts` jadvali). Login: 5 xato / 15 daqiqa / (login+IP); ro'yxatdan o'tish: 5 / soat / IP; global: 120 so'rov / daqiqa / IP (`@fastify/rate-limit`, Redis'siz — faqat bir instansiya uchun qo'shimcha himoya). |
| S8 | P0 | RLS: `sellers public read using (true)` — anon (publishable) kalit bilan `sellers` jadvali **to'liq** o'qiladi: `credits`, `user_id`, `phone`. Kalit `.env`da (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) va publik ma'noda. | `schema.sql:423` | Siyosat olib tashlanadi; publik ma'lumot uchun `public_sellers` view (`id, business_name, verified, phone`). `users`, `sessions`, `login_attempts` da `revoke all ... from anon, authenticated`. |
| S9 | P1 | Sessiya tokeni — 30 kunlik stateless HMAC, bekor qilib bo'lmaydi; `localStorage`da (XSS o'qiy oladi). Parol almashsa ham eski token ishlayveradi. | `apps/api/src/lib/session.ts`, `apps/web/src/lib/session.ts` | `sessions` jadvali (5.1), token xeshi saqlanadi, logout/parol almashtirishda bekor qilinadi. `localStorage` qoladi (web va API turli domenda), lekin token qisqa umrli emas → CSP + `httpOnly cookie` yo'li 6-bo'limda «keyingi qadam». |
| S10 | P1 | Fayl turi faqat mijoz yuborgan `mimetype` bo'yicha tekshiriladi; magic-bytes tekshiruvi yo'q. | `seller.ts:179,410`, `cars.ts:105` | `lib/imageSniff.ts` — JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, WEBP `RIFF....WEBP`. Mos kelmasa `415`. |
| S11 | P1 | Storage xato bersa rasm **base64 data-URL** bo'lib bazaga yoziladi — jimgina DB bo'kadi, yuzlab KB matn satrlari. | `apps/api/src/lib/supabase.ts:41-42` | Production'da fallback yo'q: `502 storage_unavailable`. Dev'da qoladi (ogohlantirish bilan). |
| S12 | P1 | `image_url: z.string().url()` istalgan sxemani (`javascript:`, `http:`, tashqi domen) qabul qiladi. | `seller.ts:23` | Faqat `https:` va faqat o'zimizning Storage hostimiz (`SUPABASE_URL` hosti). |
| S13 | P1 | Narx/ombor yuqori chegarasi yo'q: `numeric(12,2)` dan oshsa 500 xato. `phone`/`name` `PATCH /api/me` da uzunlik/format tekshiruvi yo'q. | `seller.ts:16-27`, `routes/auth.ts:38-55` | zod: `price ≤ 999 999 999`, `stock ≤ 99 999`, telefon `^\+998\d{9}$` (seller) / `^\+?\d{9,15}$` (buyer), `name` 2–60. |
| S14 | P1 | Buyurtma **bekor** qilinsa ombor qaytarilmaydi (`checkout_cart` kamaytirgan). Mijoz o'z buyurtmasini bekor qila olmaydi. | `seller.ts:453`, `schema.sql:332-335` | RPC `set_order_status` — bekor qilinganda `stock += quantity`. Mijoz uchun `POST /api/orders/:id/cancel` (faqat `new` holatida). |
| S15 | P1 | Savat miqdori API'da ombor bilan cheklanmaydi (faqat UI tugmani o'chiradi). | `apps/api/src/routes/cart.ts:101-113` | `quantity = min(quantity, stock)`, `> 99` rad. |
| S16 | P1 | `GET /api/products`: `limit`/`offset` raqam bo'lmasa `NaN` → 500; `search`dagi `%`/`_` wildcard bo'lib ketadi. | `catalog.ts:64-65,93` | zod query sxemasi (`limit 1..100`, `offset ≥ 0`), `search` escape. |
| S17 | P1 | Studio Zustand store `localStorage`da **foydalanuvchiga bog'lanmagan**: A chiqib B kirsa, B A ning mashinasi va generatsiyasini ko'radi. | `apps/web/src/store/useStudio.ts:56-66` | `ownerId` maydoni; logout va foydalanuvchi almashganda `reset()` + `persist.clearStorage()`. |
| S18 | P1 | Buyurtmada **o'rnatish narxi hisobga olinmaydi**: mahsulot sahifasida «o'rnatish X so'm» ko'rsatiladi, lekin savat/checkout/`checkout_cart` uni bilmaydi. | `schema.sql:277-342`, `ProductPage.tsx:124-133` | P2 (alohida reja): `cart_items.with_installation boolean` + `order_items.installation_price`. Hozircha UI matni «narxga kiritilmagan, sotuvchi kelishadi» deb aniqlashtiriladi. |
| S19 | P2 | Rol/`admin` enum ishlatilmaydi; sotuvchi tasdiqlash (`verified`) uchun boshqaruv yo'q. | `schema.sql:44` | Keyingi reja: admin panel. |
| S20 | P2 | `.env` loyiha papkasida haqiqiy kalitlar bilan; papka git repo emas (`git init` yo'q). Telegram bot token endi keraksiz. | `.env` | 0.2-qadam: token'ni BotFather'da bekor qilish, `.env`dan olib tashlash, `git init`, birinchi commit `.gitignore` bilan. |
| S21 | P2 | Vercel: `apps/api/vercel.json` `/(.*)` → `/api/$1`; Fastify `/health` marshruti shu bilan mos kelishi tekshirilmagan. Serverless so'rov limiti ~4.5 MB, backend esa 12–15 MB ruxsat beradi. | `apps/api/vercel.json`, `server.ts:21,30` | Deploy sinovida tekshirish; yuklash oldin klientda `resizeImage` (mavjud) ≤ 4 MB kafolatlanadi. |
| S22 | P2 | `apps/web` uchun SPA fallback yo'q: `/auth`, `/seller/orders` sahifani yangilasa 404 bo'lishi mumkin. | `apps/web` (vercel.json yo'q) | `apps/web/vercel.json`: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` |
| S23 | P2 | Testlar, lint yo'q (`// eslint-disable` izohi bor, lekin ESLint sozlanmagan). | butun repo | Vitest (API) + smoke skript; ESLint keyingi reja. |

### 1.2. UI / UX / Accessibility — piksel darajasi

| # | P | Muammo (o'lcham bilan) | Joyi | Tuzatish |
| --- | --- | --- | --- | --- |
| U1 | P1 | **Kontent pastki navigatsiya ostida qoladi.** `main` ga `pb-24` = 96px, nav esa `76px + safe-area-inset-bottom` (iPhone'da 76+34 = 110px) → oxirgi 14px yopiladi. | `AppShell.tsx:110` | `pb-[calc(var(--nav-h)+16px)]` |
| U2 | P1 | **Yopishqoq CTA paneli noto'g'ri offset.** `sticky bottom-20` = 80px, nav = 76px+safe. Notch'siz qurilmada 4px teshik (kontent ko'rinib turadi), notch'lida panelning pastki ~30px nav ostida qoladi. | `CartPage.tsx:128`, `ProductPage.tsx:156`, `CheckoutPage.tsx:147` | `bottom-[var(--nav-h)]` |
| U3 | P1 | **Input balandligi kasr:** `py-3` (24) + matn 15px×1.5 = 22.5 + border 2 = **48.5px** → xira chegara. | `Primitives.tsx:44-46` | `h-12` (48px) qat'iy, `text-base`. |
| U4 | P1 | Input shrifti 15px → iOS Safari fokusda sahifani **avto-zoom** qiladi (hozir `user-scalable=no` bilan yashirilgan). | `index.css:66,84-90` | `input, textarea, select { font-size: 16px }` |
| U5 | P1 | **Kasr line-height'lar** (subpiksel layout): `.t-caption` 13×1.45 = 18.85; `.t-body` 15×1.55 = 23.25; `.t-h2` 17×1.3 = 22.1; `.t-h1` 22×1.2 = 26.4; `.t-hero` 38×1.05 = 39.9. | `index.css:100-143` | Piksel qiymatlar: caption **13/18**, body **15/22**, h2 **17/22**, h1 **22/26**, display **28/32**, hero **38/40**, price **18/24**. |
| U6 | P1 | **Touch target < 44px:** `Button sm` 36px; Modal yopish 36×36; Savat ±/o'chirish 36×36; Header orqaga 40×40; `Chip` 10+10+20+2 = 42px. | `Button.tsx:30`, `Modal.tsx:25`, `CartPage.tsx:82,94,106`, `AppShell.tsx:78`, `Primitives.tsx:72` | Hamma interaktiv element `min-h-11 min-w-11` (44px). Ko'rinish kichik qolsa ham hit-area 44px (`::before` inset). |
| U7 | P1 | 11px matn (o'qish minimumi 12px dan past). | `StudioPage.tsx:171,187`, `ProfilePage.tsx:100` | 12px. |
| U8 | P1 | `text-subtle #6d747d` kontrasti: `bg #0b0c0e` da ≈ **4.15:1**, `surface #141619` da ≈ **3.9:1** (< 4.5:1 AA). Placeholder va hint'lar shu rangda. | `index.css:18` | `#7f868f` (≈ 5.3:1 / 5.0:1). Bajarishda kontrast tekshirgichda qayta o'lchanadi. |
| U9 | P1 | `maximum-scale=1.0, user-scalable=no` — zoom taqiqlangan (WCAG 1.4.4 buzilishi). Bu Telegram Mini App uchun qo'yilgan edi. | `apps/web/index.html:6` | `width=device-width, initial-scale=1, viewport-fit=cover` |
| U10 | P1 | `Inter` ro'yxatda bor, lekin **hech qayerdan yuklanmaydi** → tizim shrifti. | `index.css:37-39` | `@fontsource-variable/inter` (self-host, `latin` + `latin-ext`, `font-display: swap`). `ʻ` (U+02BB) `latin` subsetida bor — `oʻ`/`gʻ` to'g'ri chiqadi. |
| U11 | P1 | **Modal:** Esc yo'q, fokus tuzog'i yo'q, `role="dialog"`/`aria-modal` yo'q, orqa sahifa skroll qiladi. | `Modal.tsx` | Qayta yoziladi (5.6). |
| U12 | P1 | Native `confirm()` (o'chirish, bekor qilish). Uslubga mos emas, ba'zi WebView'larda bloklanadi. | `SellerPage.tsx:118,339` | `ConfirmDialog` komponenti. |
| U13 | P1 | `Button` `type` bermaydi → formada tasodifan `submit` bo'ladi. | `Button.tsx:47` | Default `type="button"`. |
| U14 | P1 | `Field` `<label>` ichida xato/hint matnini ham o'raydi (ekran o'quvchi yorlig'iga qo'shiladi); `aria-invalid`, `aria-describedby` yo'q. | `Primitives.tsx:26-41` | `useId` + alohida `<label htmlFor>` + `aria-describedby`. |
| U15 | P1 | Butun ilova `max-w-lg` (512px) ustunida — sotuvchi kompyuterdan ishlaganda 1440px ekranda 512px chiziq. | `AppShell.tsx:109` | Seller uchun alohida keng shell (≥1024px: 240px sidebar + kontent). |
| U16 | P2 | Bir sahifada ikkita `<h1>` (Header + sahifa ichi). | `AppShell.tsx:85`, `CheckoutPage.tsx:53`, `ProductPage.tsx:73` | Header sarlavhasi `<p>`; sahifa `<h1>` bitta. |
| U17 | P2 | Seller tablari `role="tablist"`/`aria-selected`siz. | `SellerPage.tsx:234-247` | Seller shell ichida route-asosli navigatsiyaga almashadi (6-bo'lim). |
| U18 | P2 | Apostrof aralash: `‘` (U+2018), `'` (ASCII) va to'g'risi `ʻ` (U+02BB). | matnlar (`SellerPage.tsx:195`, `CartPage.tsx:46` va h.k.) | Bitta konvensiya: `ʻ`/`ʼ`; `scripts/check-copy.mjs` bilan tekshiruv. |
| U19 | P2 | Rasm generatsiya/yuklash holatlarida `aria-live` yo'q. | `SellerCreditsPage`, `ResultPage` | Keyingi reja. |

---

## 2. Maqsadli arxitektura

```
Brauzer (React SPA)                          API (Fastify)                     Supabase (Postgres)
──────────────────                           ─────────────                     ───────────────────
/auth  ─ register/login ───────────────────► POST /api/auth/register ───RPC──► register_account()
                                             POST /api/auth/login    ───────► users, login_attempts
Bearer <opaque token> ─────────────────────► authenticate(): sha256(token) ──► sessions ⨝ users
RequireRole('user' | 'seller') ◄── /api/me ─ requireRole() + requireSeller()
```

### 2.1. Ro'yxatdan o'tish / kirish oqimi (foydalanuvchi nuqtai nazaridan)

```
Ilova ochiladi
  └─ token bormi?
       ├─ ha  → GET /api/me
       │         ├─ 200 → role=user   → "/"        (Studio)
       │         │        role=seller → "/seller"  (Seller panel)
       │         └─ 401 → token o'chiriladi → "/auth"
       └─ yo'q → "/auth"
                   ├─ [Ro'yxatdan o'tish]  (birinchi marta kelganlarga default)
                   │     1. Rol tanlash:  ◯ Oddiy foydalanuvchi   ◯ Avto-servis egasi
                   │     2. Ism · Login · Parol · Parolni takrorlang
                   │     3. (faqat servis egasi) Servis nomi · Telefon · Manzil
                   │     4. [Ro'yxatdan o'tish] → avtomatik kirish → roliga qarab bosh sahifa
                   └─ [Kirish]  (qaytib kelganlarga default)
                         Login · Parol → [Kirish] → roliga qarab bosh sahifa
```

### 2.2. Ruxsatlar matritsasi (marshrut va API)

| Marshrut | Mehmon | `user` | `seller` |
| --- | --- | --- | --- |
| `/auth` | ✅ | → `/` | → `/seller` |
| `/`, `/capture*`, `/result`, `/market`, `/cart`, `/checkout`, `/orders`, `/profile` | → `/auth` | ✅ | → `/seller` |
| `/product/:id` | → `/auth` | ✅ | ✅ faqat ko'rish (savatga qo'shish tugmasi yo'q) |
| `/seller`, `/seller/*` | → `/auth` | → `/` | ✅ |

API: `/api/cars*`, `/api/generations*`, `/api/cart*`, `/api/orders*` → `requireRole('user')` (403 `wrong_role`). `/api/seller/*` → `requireSeller` (rol `seller` + `sellers` qatori). `/api/products`, `/api/categories`, `/api/vehicle-models` — hozirgidek ochiq (ro'yxatdan o'tmagan mehmon ko'ra oladi, lekin UI'da baribir `/auth`ga yo'naltiriladi).

---

## 3. Ma'lumotlar bazasi

### 3.1. Yangi migratsiya: `supabase/migrations/20260918_0001_login_password_auth.sql`
Bitta tranzaksiya (`begin; … commit;`), qayta ishga tushirilsa xato bermaydi (`if not exists`, `do $$` bloklar).

```sql
create extension if not exists citext with schema extensions;

-- ---- users: login/parol ----
alter table users
  add column if not exists login            citext,
  add column if not exists password_hash    text,           -- scrypt$N$r$p$salt$hash ; null = eski Telegram akkaunt (kira olmaydi)
  add column if not exists is_active        boolean not null default true,
  add column if not exists password_changed_at timestamptz,
  add column if not exists last_login_at    timestamptz;

-- eski Telegram foydalanuvchilari: kira olmaydigan placeholder login
update users set login = 'legacy_' || telegram_id::text where login is null;

alter table users alter column login set not null;
alter table users add constraint users_login_key unique (login);
alter table users add constraint users_login_format
  check (login::text ~ '^[a-z][a-z0-9_.]{2,31}$');
alter table users add constraint users_name_len check (name is null or char_length(name) between 2 and 60);

alter table users drop column if exists telegram_id;         -- unique/not null ham shu bilan ketadi
alter table users drop column if exists username;            -- ishlatilmagan edi

-- ---- rol o'zgarmasligi ----
create or replace function users_role_immutable() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role then
    raise exception 'ROLE_IMMUTABLE';
  end if;
  return new;
end $$;
create trigger users_role_immutable before update of role on users
  for each row execute function users_role_immutable();

-- ---- sessions ----
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   bytea not null unique,                     -- sha256(token)
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  user_agent   text,
  ip           inet
);
create index sessions_user_idx on sessions (user_id) where revoked_at is null;
create index sessions_expiry_idx on sessions (expires_at);

-- ---- login_attempts (rate limit) ----
create table login_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('login','register')),
  login_key  citext,
  ip         inet not null,
  success    boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_login_idx on login_attempts (kind, login_key, created_at desc);
create index login_attempts_ip_idx    on login_attempts (kind, ip, created_at desc);

-- ---- RLS: hech qanday siyosat = anon/authenticated uchun yopiq ----
alter table sessions       enable row level security;
alter table login_attempts enable row level security;
revoke all on users, sessions, login_attempts from anon, authenticated;

-- ---- sellers: publik o'qishni yopish, faqat view ----
drop policy if exists "sellers public read" on sellers;
create or replace view public_sellers with (security_invoker = false) as
  select id, business_name, verified, phone from sellers;
grant select on public_sellers to anon, authenticated;
revoke all on sellers from anon, authenticated;
```

**RPC funksiyalar** (bir xil faylda; hammasi `language plpgsql`, `security definer` emas — service_role chaqiradi):

| Funksiya | Vazifa |
| --- | --- |
| `register_account(p_login citext, p_password_hash text, p_name text, p_role user_role, p_business_name text, p_phone text, p_address text) returns users` | **Bitta tranzaksiyada** `users` (+ `sellers`, agar `p_role='seller'`) yaratadi. Login band bo'lsa `LOGIN_TAKEN` (unique_violation'ni ushlab). `p_role='admin'` → `INVALID_ROLE`. |
| `consume_seller_credit(p_seller uuid) returns int` | `update sellers set credits = credits-1 where id=p_seller and credits>=1 returning credits`; topilmasa `NO_CREDITS`; `seller_credit_transactions` (`consume`, -1) shu ichida. |
| `refund_seller_credit(p_seller uuid) returns int` | `credits = credits+1` + tranzaksiya (`refund`). |
| `add_seller_credits(p_seller uuid, p_amount int, p_package text) returns int` | `credits = credits + p_amount` + tranzaksiya (`purchase`). Faqat `PAYMENTS_MODE=mock`da chaqiriladi. |
| `set_order_status(p_order uuid, p_seller uuid, p_next order_status) returns orders` | `select ... for update`; `ORDER_STATUS_FLOW` bo'yicha o'tishni tekshiradi (`INVALID_TRANSITION`); `cancelled`ga o'tganda har `order_items` uchun `products.stock += quantity`. |
| `cancel_own_order(p_order uuid, p_user uuid) returns orders` | Faqat `status='new'` va `user_id=p_user`; qolgani `set_order_status` mantig'i (restock). |

`seller_credit_transactions.type` check'iga `'refund'` qo'shiladi (hozir refund `purchase` + `package_id='refund'` bo'lib yozilyapti — statistika buziladi).

### 3.2. `supabase/schema.sql` yangilanadi (toza o'rnatish uchun)
- `users` jadvali yangi ko'rinishda (login/password_hash, `telegram_id` yo'q), `sessions`, `login_attempts`, view, RPC'lar qo'shiladi.
- Boshiga qizil izoh: `-- DIQQAT: bu fayl hamma jadvalni o'chiradi. Faqat bo'sh/dev baza uchun.`
- Demo `users` qatorlari (`telegram_id 100000001/2`) `login = 'demo_tuning'` / `'demo_parts'`, `password_hash = null` bilan; parolni `scripts/seed-demo-accounts.mjs` qo'yadi.

### 3.3. Skriptlar
- `scripts/db-push.mjs` → `scripts/db-migrate.mjs`: `schema_migrations(name text pk, applied_at)` jadvali; `supabase/migrations/*.sql`ni nomi bo'yicha tartib bilan, hali qo'llanmaganlarini qo'llaydi (har biri alohida tranzaksiya). `--reset` (schema.sql) — `NODE_ENV=production` bo'lsa rad, aks holda `"BAZA TO'LIQ O'CHADI. Davom etish uchun RESET deb yozing:"`. `package.json`: `"db:migrate"`, `"db:reset"`; eski `db:push` olib tashlanadi.
- `scripts/seed-demo-accounts.mjs`: `DEMO_SELLER_PASSWORD` env (yoki tasodifiy 16 belgi, bir marta konsolga chiqariladi); `demo_tuning`, `demo_parts`ga `hashPassword()` bilan `password_hash` qo'yadi. `NODE_ENV=production`da `--i-know` bayrog'isiz ishlamaydi.
- Sessiya/urinishlarni tozalash: API'da 1% ehtimol bilan `delete from sessions where expires_at < now() - interval '7 days'` va `login_attempts` >24 soat (yoki Supabase `pg_cron`, agar yoqilgan bo'lsa).

---

## 4. Backend (apps/api)

### 4.1. Fayllar

| Amal | Fayl | Izoh |
| --- | --- | --- |
| **O'chiriladi** | `src/lib/telegram.ts`, `src/lib/session.ts` | HMAC sessiya va Telegram tekshiruvlari |
| **Yangi** | `src/lib/password.ts` | `hashPassword`, `verifyPassword`, `needsRehash`, `DUMMY_HASH` |
| **Yangi** | `src/lib/sessions.ts` | `createSession`, `resolveSession`, `revokeSession`, `revokeOtherSessions` |
| **Yangi** | `src/lib/validation.ts` | zod: `loginSchema`, `passwordSchema`, `registerSchema`, `phoneUz`, `RESERVED_LOGINS`, `COMMON_PASSWORDS` |
| **Yangi** | `src/lib/rateLimit.ts` | `checkLoginLimit`, `recordAttempt`, `checkRegisterLimit` |
| **Yangi** | `src/lib/imageSniff.ts` | magic-bytes |
| **Qayta yoziladi** | `src/lib/auth.ts` | `authenticate` (faqat Bearer), `requireRole`, `requireSeller`, `toPublicUser`, `USER_COLUMNS` |
| **Qayta yoziladi** | `src/routes/auth.ts` | register / login / logout / me / password |
| **O'zgaradi** | `src/env.ts` | `botToken`, `botUsername`, `allowInsecureAuth`, `sessionSecret` olib tashlanadi; `paymentsMode`, `sessionTtlDays` qo'shiladi |
| **O'zgaradi** | `src/lib/errors.ts` | `HttpError`ga `fields?: Record<string,string>` va `retryAfter?: number`; `conflict()`, `tooMany()`, `unprocessable()` |
| **O'zgaradi** | `src/server.ts` | error handler `fields`/`Retry-After`ni yuboradi; `@fastify/rate-limit` global; CORS `credentials` yo'q (Bearer) — o'zgarmaydi |
| **O'zgaradi** | `src/routes/seller.ts` | `/register` **o'chiriladi**; kredit RPC'lari; `set_order_status`; `imageSniff`; zod cheklovlari |
| **O'zgaradi** | `src/routes/{cars,generations,cart,orders}.ts` | `authenticate` → `requireRole('user')`; cart miqdor cheklovi; `orders/:id/cancel` |
| **O'zgaradi** | `src/routes/catalog.ts` | query zod, `search` escape, seller ma'lumoti `public_sellers` orqali |
| **O'zgaradi** | `packages/shared/src/types.ts` | `User`: `telegram_id` → `login: string`; `AuthSession`; `RegisterInput`; `LoginInput`; `ApiError.fields?` |

### 4.2. API shartnomasi

`Content-Type: application/json`. Xato formati: `{ "error": "<kod>", "message": "<uz matn>", "fields"?: { "<maydon>": "<uz matn>" } }`.

| Endpoint | Body | Muvaffaqiyat | Xatolar |
| --- | --- | --- | --- |
| `POST /api/auth/register` | `{ role:'user'\|'seller', name, login, password, business_name?, phone?, address? }` (`seller` bo'lsa `business_name`, `phone` majburiy) | `201 { token, expires_at, user, seller? }` (avtomatik kirish) | `422 validation_error` (+`fields`), `409 login_taken`, `429 rate_limited` |
| `POST /api/auth/login` | `{ login, password }` | `200 { token, expires_at, user, seller? }` | `401 invalid_credentials` («Login yoki parol noto'g'ri» — login yo'q / parol xato / akkaunt eski — **bir xil**), `403 account_disabled`, `429 rate_limited` (+`Retry-After`) |
| `POST /api/auth/logout` | — | `204` | (token yo'q bo'lsa ham `204`) |
| `GET /api/auth/login-available?login=…` | — | `200 { available:boolean }` | `422`, `429` (60/soat/IP) |
| `GET /api/me` | — | `200 { user, seller }` | `401` |
| `PATCH /api/me` | `{ name?, phone? }` | `200 { user }` | `422` |
| `POST /api/me/password` | `{ current_password, new_password }` | `200 { ok:true }` — joriy sessiyadan **tashqari** hammasi bekor | `401 invalid_credentials`, `422` |
| `POST /api/orders/:id/cancel` | — | `200 { order }` | `404`, `409 not_cancellable` |

**Javobda hech qachon:** `password_hash`, `token_hash`, `ip`, boshqa foydalanuvchi ma'lumoti.

### 4.3. Qoidalar (validation.ts)

| Maydon | Qoida | Xato matni (uz) |
| --- | --- | --- |
| `login` | `trim().toLowerCase()`; `^[a-z][a-z0-9_.]{2,31}$`; ketma-ket `..`/`__` yo'q; oxiri `.`/`_` emas; `RESERVED_LOGINS` (`admin, root, support, carvision, api, seller, system, null, undefined, test, demo`…) | «Login 3–32 belgi: lotin harflari, raqam, `_` va `.`; harf bilan boshlanadi» / «Bu login band» / «Bu loginni ishlatib bo'lmaydi» |
| `password` | 8…128 belgi (NIST: tarkib qoidalari yo'q); `login`ga teng emas; `COMMON_PASSWORDS` (~200 ta eng ko'p uchraydigan) da yo'q; faqat bo'shliqdan iborat emas | «Kamida 8 belgi» / «Parol loginga o'xshash bo'lmasin» / «Bu parol juda oson topiladi» |
| `name` | trim, 2…60, boshqaruv belgilari yo'q | «Ismingizni kiriting (2–60 belgi)» |
| `business_name` | trim, 2…120 | «Servis nomini kiriting» |
| `phone` (seller) | bo'shliq/`-`/`()` olib tashlanadi; `^\+998\d{9}$` | «Telefon: +998 XX XXX XX XX» |
| `address` | ≤ 200, ixtiyoriy | — |
| `role` | `'user'` yoki `'seller'` (`admin` — rad) | «Rolni tanlang» |

### 4.4. Parol xeshi (password.ts)
- `crypto.scrypt`, **N = 16384, r = 8, p = 5**, 16 bayt tuz, 64 bayt kalit (OWASP tavsiya etilgan kombinatsiya; ~16 MiB xotira → serverless'ga mos). Format: `scrypt$16384$8$5$<salt b64>$<hash b64>`.
- `verifyPassword` — `timingSafeEqual`. Login topilmasa ham **`DUMMY_HASH`** bilan xuddi shu hisob bajariladi (vaqt orqali login mavjudligini bilib bo'lmasin).
- `needsRehash(hash)` — parametrlar eskirsa, muvaffaqiyatli loginda yangidan xeshlanadi.
- Parol hech qachon log'ga, xato xabariga, `console`ga tushmaydi. Fastify `logger.redact`: `req.headers.authorization`, `req.body.password`, `req.body.new_password`, `req.body.current_password`.

### 4.5. Sessiya (sessions.ts)
- Token: `cv_` + `randomBytes(32).toString('base64url')` (256 bit). DB'da faqat `sha256(token)` (`bytea`).
- Muddat: 30 kun mutlaq; `last_used_at` soatiga ko'pi bilan 1 marta yangilanadi (har so'rovda yozuv yo'q); 15 kundan kam qolsa `expires_at` yana 30 kunga uzaytiriladi (sliding).
- `resolveSession(token)`: bitta so'rov — `sessions` ⨝ `users` (`USER_COLUMNS`), `revoked_at is null`, `expires_at > now()`, `users.is_active`.
- Parol almashtirilganda: joriy sessiyadan tashqari hammasi `revoked_at = now()`.
- Bitta foydalanuvchida ≤ 10 faol sessiya; ortig'i eng eskisidan boshlab bekor qilinadi.

### 4.6. Rate limit (rateLimit.ts) — barchasi bazadagi `login_attempts` bo'yicha
| Chegara | Qiymat | Reaksiya |
| --- | --- | --- |
| Login: `(login_key)` xato urinish | 5 / 15 daq | `429`, `Retry-After` = eng eski urinish + 15 daq |
| Login: `(ip)` xato urinish | 20 / 15 daq | `429` |
| Register: `(ip)` | 5 / soat | `429` |
| `login-available`: `(ip)` | 60 / soat | `429` |
| Global (`@fastify/rate-limit`) | 120 / daq / IP | `429` |
Muvaffaqiyatli login shu login'ning xato hisobini nolga tushirmaydi (hujumchi o'z akkaunti bilan aylanib o'tmasin), faqat yangi yozuv `success=true` bo'ladi va limit hisobiga kirmaydi. Prodda IP `x-forwarded-for` dan (Fastify `trustProxy: true` Vercel'da).

### 4.7. `.env.example` yangi ko'rinishi
Olib tashlanadi: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `ALLOW_INSECURE_AUTH`, `SESSION_SECRET`, `VITE_TELEGRAM_BOT_USERNAME`, `VITE_ALLOW_INSECURE_AUTH`.
Qo'shiladi: `PAYMENTS_MODE=mock` (`mock` faqat dev; prod'da `off`), `DATABASE_URL=` (migratsiya uchun), `DEMO_SELLER_PASSWORD=`.

---

## 5. Frontend (apps/web)

### 5.1. Fayllar

| Amal | Fayl | Izoh |
| --- | --- | --- |
| **O'chiriladi** | `components/AuthGate.tsx`, `pages/LoginPage.tsx`, `lib/telegram.ts` | |
| **Yangi** | `lib/haptics.ts` | `haptic()`, `notify()` — `navigator.vibrate` (mavjud bo'lsa, `prefers-reduced-motion`ni hurmat qiladi). Importlar: `Button.tsx`, `CapturePage.tsx`, `ConfiguratorDock.tsx`, `CheckoutPage.tsx`, `ProductPage.tsx`, `StudioPage.tsx` |
| **Yangi** | `auth/AuthProvider.tsx`, `auth/useAuth.ts` | holat: `loading \| guest \| user \| seller`; `login()`, `register()`, `logout()`, `refresh()` |
| **Yangi** | `auth/guards.tsx` | `RequireAuth`, `RequireRole`, `GuestOnly` |
| **Yangi** | `pages/AuthPage.tsx` | login + register (5.3-bo'lim: piksel spetsifikatsiya) |
| **Yangi** | `components/auth/{RoleCard,PasswordField,LoginField,StrengthMeter,SellerFields}.tsx` | |
| **Yangi** | `components/ui/{ConfirmDialog,Segmented,Toast}.tsx` | |
| **Yangi** | `components/seller/{SellerShell,SellerNav,OrderCard,ProductTable}.tsx`, `pages/seller/{SellerOverview,SellerProducts,SellerOrders,SellerProfile}.tsx` | |
| **Qayta yoziladi** | `App.tsx` | marshrutlar + guard'lar |
| **Qayta yoziladi** | `lib/api.ts` | Telegram yo'q; faqat Bearer; 401 mantig'i (5.2) |
| **Qayta yoziladi** | `lib/session.ts` | `storage` hodisasi bilan tablararo sinxron |
| **O'zgaradi** | `main.tsx` | `initTelegram` olib tashlanadi; `AuthProvider` |
| **O'zgaradi** | `index.html` | `telegram-web-app.js` `<script>` olib tashlanadi; viewport (U9) |
| **O'zgaradi** | `pages/ProfilePage.tsx` | «Sotuvchi kabineti» qatori olib tashlanadi; Chiqish + Parolni almashtirish; login ko'rsatiladi |
| **O'zgaradi** | `store/useStudio.ts` | `ownerId` (S17) |
| **O'zgaradi** | `components/AppShell.tsx` | U1; rolga qarab shell tanlash |
| **O'zgaradi** | `components/ui/{Primitives,Button,Modal,Icon,States}.tsx`, `index.css` | 5.5–5.6 |
| **O'zgaradi** | `packages/shared/src/types.ts` | 4.1 |

### 5.2. `lib/api.ts` qoidalari
- `authHeader()`: token bo'lsa `Bearer <token>`, yo'q bo'lsa hech narsa.
- `401` da `carvision:session-expired` hodisasi **faqat** `/api/auth/login|register|login-available` bo'lmagan so'rovlarda (aks holda noto'g'ri parol kiritish «sessiya tugadi» tepkisini keltirib chiqaradi).
- `ApiRequestError` ga `fields?: Record<string,string>` va `retryAfter?: number`.
- Yangi: `api.register`, `api.login`, `api.logout`, `api.loginAvailable`, `api.changePassword`, `api.cancelOrder`. O'chadi: `telegramLogin`, `registerSeller`.
- Har so'rovga `AbortSignal.timeout(30_000)` (yuklash/AI uchun 90_000).

### 5.3. AuthPage — piksel spetsifikatsiyasi

Hamma o'lcham `px`; Tailwind v4 shkalasi: `1 = 4px`. Tokenlar `index.css @theme` dagilar.

**Sahifa konteyneri**
- `min-h-dvh`, `bg-bg`, flex-column.
- Padding: `px-5` (**20px**), `pt-[max(24px,env(safe-area-inset-top))]`, `pb-[max(24px,env(safe-area-inset-bottom))]`.
- ≥ 640px: forma **kartaga** o'raladi — `w-[440px] max-w-full`, `rounded-2xl` (**24px**), `border` 1px `border-border`, `bg-surface`, `p-8` (**32px**), vertikal-gorizontal markazda. < 640px: karta yo'q (bevosita `bg-bg`).
- ≥ 1024px: chapda brend paneli (`w-1/2`, `bg-surface`, o'ng chegara 1px, ichida logo + 3 ta qiymat bandi), o'ngda forma ustuni `max-w-[420px]`.

**Brend qatori:** logo `40×40` (`rounded-lg` 16px, `object-contain`) + «CARVISION» `17px/24px`, `font-weight 500`, `letter-spacing 0.2em`; oralig'i `gap-3` (12px); pastdan `mb-8` (**32px**).

**Sarlavha:** `t-display` **28/32**, `-0.03em`, 650 — «Xush kelibsiz»; ostida `mt-2` (8px) `15/22 text-muted` — «Davom etish uchun kiring yoki akkaunt oching.»; keyin `mb-6` (**24px**).

**Segmented (Kirish | Ro'yxatdan o'tish):** tashqi `h-12` (**48px**), `rounded-lg` (16px), `border` 1px, `bg-surface`, `p-1` (4px). Ichki tugma `h-10` (**40px**), `flex-1`, `rounded-md` (12px), `14/20 font-medium`. Faol: `bg-surface-2`, `text-text`, `border 1px border-border-strong`; nofaol: `text-text-muted`. `role="tablist"`, tugmalar `role="tab" aria-selected`, ←/→ tugmalari bilan almashadi. Panel `role="tabpanel"`. Default: `localStorage.carvision_seen_auth` yo'q → «Ro'yxatdan o'tish», bor → «Kirish». `mb-6` (24px).

**Rol kartalari** (faqat Ro'yxatdan o'tishda, forma tepasida) — `role="radiogroup" aria-label="Akkaunt turi"`, savol sarlavhasi `t-h2` **17/22**: «Siz kimsiz?», `mb-3` (12px). Kartalar ustma-ust, `gap-3` (**12px**).
- Karta: `min-h-[72px]`, `p-4` (16px), `rounded-lg` (16px), `border` 1px, `flex items-center gap-3`.
- Chapda ikon plitkasi `40×40`, `rounded-md` (12px), `bg-surface-2`, ikon `20px` (`user` / `store`).
- Matn: sarlavha `15/20 font-semibold`; tavsif `13/18 text-muted` (`mt-0.5`).
  - «Oddiy foydalanuvchi» — «Mashinamni vizuallashtiraman, ehtiyot qism sotib olaman»
  - «Avto-servis egasi» — «Mahsulot qo'shaman, buyurtmalarni qabul qilaman»
- O'ngda radio belgisi `20×20` doira, `border 2px border-border-strong`. **Tanlangan:** karta `border-accent bg-accent/12`, doira `bg-accent border-accent` ichida `check` ikoni `14px` oq (rangdan tashqari **shakl** ham o'zgaradi).
- Fokus: `outline-none ring-2 ring-accent-soft ring-offset-2 ring-offset-bg`. Klaviatura: ↑/↓ tanlaydi, Space belgilaydi. Tanlanmagan holda «Ro'yxatdan o'tish» bosilsa — karta guruhi ostida xato: «Akkaunt turini tanlang».
- Karta guruhidan keyin `mb-6` (24px).

**Maydonlar** (oraliq `space-y-4` = **16px**)
- Yorliq: `14/20 font-medium`, `mb-2` (**8px**), `<label htmlFor>`.
- Input: `h-12` (**48px**), `px-4` (16px), `text-base` (**16/24**), `rounded-lg` (16px), `border` 1px `border-border`, `bg-surface`; placeholder `text-text-subtle` (yangi #7f868f). Fokus: `border-accent` + `ring-1 ring-accent` (jami 2px ko'rinish). Xato: `border-danger ring-1 ring-danger`, `aria-invalid="true"`.
- Xato matni: `13/18`, `mt-2` (8px), `text-danger`, chapda `alert` ikoni **14px** (`gap-1.5` = 6px), `id={fieldId}-err`, inputda `aria-describedby`. Hint: `13/18 text-text-subtle`, `mt-2`.
- Maydonlar tartibi: **Ismingiz** (`autoComplete="name"`) → **Login** → **Parol** → **Parolni takrorlang**. Kirishda faqat Login + Parol.
- **Login:** `autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" inputMode="text" name="username"`. O'ngda holat belgisi `16px` (spinner / `check` success / `alert` danger), input `pr-11` (44px). Bo'sh joyni yo'qotmaslik uchun tekshiruv **debounce 400ms**, faqat format to'g'ri bo'lganda `GET /api/auth/login-available`. Yozilayotganda avtomatik kichik harfga o'tkaziladi.
- **Parol:** o'ngda ko'rsatish/yashirish tugmasi `48×48` (`absolute right-0 top-0`), ikon `20px` (`eye`/`eye-off`), `aria-label="Parolni ko'rsatish"|"Parolni yashirish"`, `aria-pressed`. Input `pr-12` (48px). `autoComplete="new-password"` (ro'yxat) / `"current-password"` (kirish).
- **Kuch o'lchagich** (faqat ro'yxatdan o'tishda): input ostida `mt-2`; 4 ta segment `h-1` (**4px**) `flex-1` `gap-1` (4px) `rounded-full`; bo'sh `bg-border-strong`; 1 → `danger`, 2 → `warning`, 3 → `accent`, 4 → `success`. O'ngda matn `13/18` («Zaif / O'rtacha / Yaxshi / Kuchli») — rang bilan birga **matn ham**. Hisoblash: uzunlik (≥8, ≥12, ≥16) + tur xilma-xilligi; `COMMON_PASSWORDS`da bo'lsa 1 segmentdan oshmaydi.
- **Ogohlantirish bloki** (ro'yxatdan o'tishda, parol maydonlari ostida, `mt-4`): `rounded-lg border border-warning/30 bg-warning/10 p-3` (12px), `13/18`, chapda `alert` **16px** — «Parolni tiklash imkoni hozircha yo'q. Parolingizni xavfsiz joyda saqlang.» (qaror: tiklash yo'q — foydalanuvchi oldindan biladi).

**Servis ma'lumotlari** (faqat `Avto-servis egasi` tanlanganda; balandlik animatsiyasi `grid-template-rows: 0fr → 1fr`, **200ms** `cubic-bezier(0.16,1,0.3,1)`; `prefers-reduced-motion`da animatsiyasiz):
- Ajratgich: `border-t` 1px, `mt-6` (24px) `pt-6` (24px); sarlavha `t-h2` 17/22 «Servis ma'lumotlari», `mb-4` (16px).
- Maydonlar: **Servis nomi** (2–120, `autoComplete="organization"`), **Telefon** (`type="tel" inputMode="tel" autoComplete="tel"`, `+998` prefiksi bilan niqob `+998 90 123 45 67`, yuborishda `+998901234567`), **Manzil** (ixtiyoriy, `autoComplete="street-address"`).

**Yuborish tugmasi:** `Button size="lg"` **56px** balandlik, `fullWidth`, `rounded-lg`, `mt-6` (24px), `type="submit"`. Matn: «Ro'yxatdan o'tish» / «Kirish». Yuborilayotganda spinner 16px + matn saqlanadi, tugma `disabled`. **Bo'sh maydonlar tufayli `disabled` qilinmaydi** (foydalanuvchi nima xato ekanini ko'rsin) — tekshiruv `blur` va `submit`da; xato bo'lsa birinchi xatoli maydonga `focus()` + `aria-live="polite"` xulosa.
- `<form noValidate onSubmit>`; Enter yuboradi.

**Pastki havola:** `min-h-11` (44px), markazda, `14/20`: «Akkauntingiz bormi? **Kirish**» / «Akkauntingiz yo'qmi? **Ro'yxatdan o'tish**» — havola `text-accent-soft` `font-medium`, `mt-4` (16px).

**Global xato bloki** (server xatosi): `role="alert"`, `rounded-lg border border-danger/30 bg-danger/10 p-3`, `14/20`, `alert` 16px. Rate limit: «Juda ko'p urinish. 14:32 dan keyin qayta urinib ko'ring.» — soniya sanog'i (`mm:ss`, `aria-live="off"`, har 1s yangilanadi), tugma shu vaqt `disabled`.

**Holatlar jadvali**
| Holat | Ko'rinish |
| --- | --- |
| Boshlang'ich yuklanish (`/api/me` tekshirilmoqda) | To'liq ekran `Spinner 24px` + «Yuklanmoqda…» (`LoadingState`), 150ms dan keyin ko'rinadi (flicker yo'q) |
| Login band | Login ostida `danger` xato «Bu login band» + belgi |
| Tarmoq xatosi | Global blok «Ulanishni tekshiring va qayta urinib ko'ring» |
| Muvaffaqiyat | Yo'naltirish (`replace`) — `state.from` bo'lsa o'sha joyga, aks holda rolga qarab `/` yoki `/seller` |

### 5.4. Seller panel — struktura va piksel spetsifikatsiyasi

**Marshrutlar**
| Yo'l | Sahifa |
| --- | --- |
| `/seller` | Umumiy (KPI, ogohlantirishlar, AI kredit kartasi) |
| `/seller/products` | Mahsulotlar ro'yxati (+ qidiruv, filtr, «Yangi mahsulot») |
| `/seller/orders` | Buyurtmalar (status filtri) |
| `/seller/credits` | AI kredit (mavjud, tuzatiladi) |
| `/seller/profile` | Servis profili + akkaunt (login, parolni almashtirish, chiqish) |

**SellerShell**
- **< 1024px:** yuqori `Header` 56px (mavjud) + pastki nav `min-h-[var(--nav-h)]` (76px+safe), 4 band: **Panel** (`grid`), **Mahsulotlar** (`package`), **Buyurtmalar** (yangi `clipboard` ikoni), **Profil** (`user`). Buyurtmalarda «yangi» soni nishoni (mavjud savat nishoni bilan bir xil: `min-w-4`, `10px/16px`, `bg-accent`). Kontent `pb-[calc(var(--nav-h)+16px)]`, `px-4`.
- **≥ 1024px:** `grid-cols-[240px_1fr]`. Sidebar: `sticky top-0 h-dvh w-60` (**240px**), `border-r` 1px, `bg-surface`, `p-4` (16px). Yuqorida logo qatori `h-10` + `mb-6`. Nav bandi `h-11` (**44px**) `px-3` (12px) `rounded-md` (12px) `gap-3` `14/20 font-medium`, ikon 20px; faol: `bg-surface-2 text-text` + chapda `w-[3px]` accent chizig'i (mavjud nav bilan bir xil til); pastda foydalanuvchi bloki: avatar `40×40` (bosh harflar), ism `14/20`, `@login` `13/18 text-muted`, «Chiqish» `h-11`.
- Kontent: `mx-auto max-w-[1120px] px-8` (32px) `py-8` (32px). Sahifa sarlavhasi `t-h1` **22/26** + o'ngda asosiy amal (`Button md` 48px → desktopda `h-11` 44px, `w-auto`).

**Umumiy (KPI)**
- Grid: mobil `grid-cols-2 gap-3` (12px); ≥1024 `grid-cols-4 gap-4` (16px).
- KPI karta: `p-4` (16px, desktopda `p-5` 20px), yorliq `13/18 text-muted`, qiymat **24/28** `font-weight 650` `tabular-nums`, `mt-1` (4px). Kartalar: Yangi buyurtma (accent), Jami buyurtma, Mahsulotlar, Tushum (`shortMoney`).
- Ostida: «Ombor tugayapti» (warning) va «AI kredit» kartalari (`p-4`, ikon plitka `40×40`), desktopda yonma-yon 2 ustun.
- Bo'sh holat (mahsulot 0): `EmptyState` + CTA «Birinchi mahsulotni qo'shish» — yangi sotuvchi uchun onboarding ro'yxati (3 qadam: profilni to'ldirish → mahsulot qo'shish → AI rasm) `check`/raqam belgisi bilan.

**Mahsulotlar**
- Asboblar qatori: qidiruv `Input h-12` (`search` ikoni chapda, `pl-11` 44px) + kategoriya `select h-12` + holat filtri (Hammasi/Faol/O'chirilgan) `Segmented`. Mobil — ustma-ust `gap-3`; ≥1024 — bir qator, qidiruv `flex-1`, select `w-[200px]`.
- **≥ 1024px jadval:** sarlavha qatori `h-11` (44px) `13/18 text-muted uppercase-siz`, `border-b`; qator `h-[72px]`, `border-b` 1px; ustunlar: **Rasm** `56×56` (`rounded-md` 12px, `object-cover`) · **Nomi** (`15/20 font-medium`, ostida kategoriya·moslik `13/18 text-muted`) · **Narx** (o'ngga tekis, `tabular-nums`) · **Ombor** (`≤ LOW_STOCK_THRESHOLD` bo'lsa `warning` belgi + matn «Kam qoldi») · **Holat** (`Badge`) · **Amallar** (tahrirlash/o'chirish `44×44` ikon tugmalar, `aria-label`).
- **< 1024px kartalar:** mavjud `ProductRow` (rasm `56×56`), tugmalar `h-11`.
- O'chirish — `ConfirmDialog` («"X" o'chirilsinmi? Katalogdan yashiriladi, buyurtma tarixi saqlanadi. Keyin tiklash mumkin.»).
- **Mahsulot formasi:** mobil — pastdan chiquvchi sheet (mavjud `Modal`, tepasida vizual tutqich `36×4` `rounded-full` `mt-2`); ≥1024 — o'ngdan **drawer** `w-[520px]`, to'liq balandlik, kirish **220ms** `translateX(100%→0)`. Bo'limlar (`t-h2` 17/22, orasi `mt-6`/24px): **Rasm** · **Asosiy** (nomi, kategoriya, brend, tavsif) · **Narx va ombor** · **O'rnatish** · **Mos modellar**. Rasm maydoni `aspect-square w-40` (**160×160**, hozir `h-36 w-full` = 144px cho'zilgan) yoki `aspect-[4/3]`; ostida «JPG, PNG yoki WEBP · 12 MB gacha». Narx maydoni ming ajratgich bilan (`1 400 000`), o'ngda «so'm» qo'shimchasi, `inputMode="numeric"`. Saqlash tugmasi drawer/sheet pastida yopishqoq (`sticky bottom-0`, `border-t`, `p-4`, `bg-bg`), `h-14` (56px). Yopishda o'zgarish bo'lsa «O'zgarishlar saqlanmadi. Chiqilsinmi?» `ConfirmDialog`.
- Inline xatolar (`fields` bo'yicha): server `422 fields` → mos maydon ostida.

**Buyurtmalar**
- Status filtri: gorizontal `Chip` qatori (`h-11`), har birida son: Hammasi · Yangi · Qabul qilingan · O'rnatilmoqda · Tugagan · Bekor.
- Buyurtma kartasi: sarlavha `#abcd1234` + sana, `Badge` status; mijoz bloki — **ism** va **telefon** (`<a href="tel:+998…">`, `min-h-11`); mahsulotlar ro'yxati; jami; izoh; keyingi status tugmalari `h-11`. Bekor qilish → `ConfirmDialog` (matn: «Ombor qaytariladi»). Ro'yxat yangilanishi: `refetchInterval: 30_000` (faqat ko'rinib turganda).
- ≥1024: 2 ustunli grid (`gap-4`).

**Profil (`/seller/profile`)**
- «Servis» bo'limi: mavjud `SellerProfileForm` (yangi `Field` bilan) + `verified` holati (Badge).
- «Akkaunt»: login (o'qish uchun, nusxalash tugmasi), **Parolni almashtirish** (joriy, yangi, takror — `PasswordField`), «Chiqish», va ogohlantirish «Parolni tiklash imkoni hozircha yo'q».

### 5.5. Dizayn tizimi tuzatishlari (`index.css`, `Primitives`, `Button`, `Icon`)
- **Tipografiya sinflari** (U5): `.t-hero 38/40`, `.t-display 28/32`, `.t-h1 22/26`, `.t-h2 17/22`, `.t-body 15/22`, `.t-caption 13/18`, `.t-price 18/24`. `body` `line-height: 22px`.
- **Ranglar:** `--color-text-subtle: #7f868f` (U8). `--color-warning` matn sifatida kichik o'lchamda: `#d68a1e` `bg`da ≈ 7:1 — o'zgarmaydi.
- **Kontrol o'lchamlari:** `Input/select`: `h-12 px-4 text-base`; `Textarea`: `min-h-24 py-3 text-base leading-6`; `Button`: `sm h-11 px-4` (**44px**), `md h-12`, `lg h-14`; `Chip h-11`; ikon-tugma `h-11 w-11`.
- **Field:** `useId`, `<label htmlFor>`, `aria-describedby`, `aria-invalid`; xato/hint `13/18`.
- **Button:** default `type="button"`; `loading` da `aria-busy`.
- **Yangi ikonlar** (24×24 viewBox, stroke 1.6, mavjud uslub bilan): `eye`, `eye-off`, `lock`, `log-out`, `phone`, `clipboard`, `info`, `copy`. (`Icon.tsx` hozir 26 ta ikonga ega.)
- **Global:** `input, textarea, select { font-size: 16px }` (U4); `:focus-visible` `outline: 2px solid var(--color-accent-soft); outline-offset: 2px`.
- **Shrift:** `@fontsource-variable/inter` import `main.tsx`da (U10).
- **`AppShell`:** U1; `hideNav` mantig'i rolga qarab (seller uchun `SellerShell`).
- **CTA panellari:** U2.

### 5.6. Modal / ConfirmDialog
- `role="dialog" aria-modal="true" aria-labelledby`; ochilganda fokus birinchi fokuslanadigan elementga (yoki sarlavhaga), yopilganda ochgan elementga qaytadi; `Tab` ichkarida aylanadi; `Esc` yopadi; `body { overflow: hidden }` ochiq paytda (yopilganda tiklanadi, `padding-right` siljishi yo'q — scrollbar 0px).
- Overlay `bg-black/60`; `backdrop-blur-sm` faqat `@media (min-width: 1024px)` (mobil GPU tejamkorligi).
- Kirish animatsiyasi 180–220ms; `prefers-reduced-motion`da yo'q.
- `ConfirmDialog`: `max-w-[400px]`, `p-5` (20px), sarlavha `17/22`, matn `15/22 text-muted`, tugmalar `h-12` yonma-yon `gap-3` (mobilda ustma-ust), xavfli amalda tasdiq tugmasi `variant="danger"`.

---

## 6. Bosqichlar (ketma-ketlik va bog'liqliklar)

| Bosqich | Mazmun | Bog'liqlik |
| --- | --- | --- |
| **0. Tayyorgarlik** | 0.1 Bu reja `plans/01-auth-roles-seller-panel.md` ga ko'chiriladi. 0.2 Bazadan zaxira nusxa (Supabase Dashboard → Database → Backups yoki `pg_dump`); Telegram bot tokenini BotFather'da bekor qilish; `git init` + `.gitignore` tekshiruvi + birinchi commit. 0.3 `npm run typecheck` va `npm run build` — boshlang'ich holat toza ekanini tasdiqlash. | — |
| **1. DB** | Migratsiya (3.1), `schema.sql` yangilash (3.2), `db-migrate.mjs`, `seed-demo-accounts.mjs` (3.3). Dev bazaga qo'llash. | 0 |
| **2. Shared + API auth** | `types.ts`; `password/sessions/validation/rateLimit/imageSniff`; `auth.ts` qayta yozish; `routes/auth.ts`; `env.ts`; `errors.ts`; `server.ts` (logger redact, error handler). `telegram.ts`/`session.ts` o'chirish. Vitest testlari (7.2). | 1 |
| **3. API himoyasi** | `requireRole` ni cars/generations/cart/orders ga; seller.ts (kredit RPC, `set_order_status`, `/register` o'chirish, sniff, zod); orders cancel; catalog query zod; `PAYMENTS_MODE`. | 2 |
| **4. Web auth yadrosi** | `lib/haptics.ts` + importlar; `lib/api.ts`, `lib/session.ts`; `auth/*`; `AuthPage` va `components/auth/*`; `App.tsx` marshrutlar; `main.tsx`, `index.html` (Telegram skripti va viewport); `useStudio.ownerId`; `ProfilePage`. | 2 |
| **5. Dizayn tizimi** | `index.css` (tipografiya, rang, input 16px), `Primitives`, `Button`, `Icon` (yangi ikonlar), `Modal` + `ConfirmDialog`, `Segmented`, U1/U2, Inter. | 4 bilan parallel |
| **6. Seller panel** | `SellerShell`, sahifalar (5.4), `ProductTable`, drawer/sheet forma, buyurtma kartasi, profil/akkaunt, `SellerCreditsPage` tuzatish. | 3, 4, 5 |
| **7. Tozalash va hujjat** | `.env.example`, README (Telegram bo'limlari o'rniga «Akkaunt va rollar»), izohlardagi Telegram eslatmalari, `apps/web/vercel.json`, `check-copy.mjs` (U18). | 6 |

Keyingi rejalar (bu reja doirasidan tashqari): parolni tiklash (SMS/email), o'rnatish narxi savatda (S18), admin panel/sotuvchi tasdiqlash (S19), `httpOnly` cookie (web+API bitta domenda bo'lsa), mahsulot uchun ko'p rasm, real to'lov (Payme/Click).

---

## 7. Tekshirish (verification)

### 7.1. Avtomatik
```
npm run typecheck          # shared → api → web, xatosiz
npm run build              # 3 ta workspace
npm run db:migrate         # DATABASE_URL bilan; ikkinchi marta ishga tushirsa "0 ta yangi migratsiya"
npm run test -w @carvision/api   # Vitest
node scripts/smoke-auth.mjs      # ishlayotgan API (localhost:8787) ga qarshi
```

### 7.2. Vitest (apps/api) — majburiy holatlar
1. `hashPassword` ≠ ikki marta bir xil (tuz), `verifyPassword` to'g'ri/noto'g'ri, format `scrypt$16384$8$5$…`, `needsRehash`.
2. `loginSchema`: `Ab_c` → `ab_c`; `1abc`, `a`, `ab`, 33 belgi, `a..b`, `admin` — rad.
3. `passwordSchema`: 7 belgi rad; `password`, `12345678` rad; login'ga teng rad; 128 dan uzun rad; oddiy 12 belgili qabul.
4. `phoneUz`: `+998 90 123-45-67` → `+998901234567`; `901234567` rad.
5. `imageSniff`: haqiqiy JPEG/PNG/WEBP bosh baytlari OK; `.jpg` nomli PDF/SVG/HTML rad.
6. `toPublicUser` `password_hash`, `is_active`ni o'tkazmaydi.
7. Rate limit hisob-kitobi (5 xato → 6-chi bloklanadi; 15 daqiqadan keyin ochiladi) — `db` mock bilan.

### 7.3. `scripts/smoke-auth.mjs` — bosqichma-bosqich (kutilgan natija)
| # | So'rov | Kutiladi |
| --- | --- | --- |
| 1 | `GET /api/me` tokensiz | `401` |
| 2 | Register `user` (`smoke_user1`) | `201`, `token`, `user.role='user'`, javobda `password_hash` **yo'q** |
| 3 | Bir xil login qayta | `409 login_taken` (registr farqsiz: `Smoke_User1` ham) |
| 4 | Register `seller` (biznes nomi/telefon bilan) | `201`, `seller.id` bor |
| 5 | Register `seller`, telefonsiz | `422`, `fields.phone` |
| 6 | Register `role:'admin'` | `422` |
| 7 | Login to'g'ri | `200` |
| 8 | Login noto'g'ri parol ×5 → 6-chi | 5 × `401`, 6-chi `429` + `Retry-After` |
| 9 | Noma'lum login vs noto'g'ri parol | **bir xil** xabar va deyarli bir xil vaqt |
| 10 | `user` tokeni bilan `GET /api/seller/stats` | `403` |
| 11 | `seller` tokeni bilan `POST /api/cart/items` | `403 wrong_role` |
| 12 | `seller` tokeni bilan `POST /api/seller/products` | `200` |
| 13 | `POST /api/seller/credits/purchase` (`PAYMENTS_MODE=off`) | `503` |
| 14 | 10 parallel `POST /api/seller/generate` (kredit 3) | aynan 3 tasi kredit sarflaydi, balans hech qachon < 0 |
| 15 | `POST /api/auth/logout` → shu token bilan `GET /api/me` | `204` → `401` |
| 16 | Parol almashtirish → eski (boshqa) sessiya | `401`, joriy sessiya `200` |
| 17 | Bekor qilingan buyurtma | `products.stock` qaytadi |
| 18 | `UPDATE users SET role='seller'` (SQL orqali) | `ROLE_IMMUTABLE` xatosi |
| 19 | Anon kalit bilan `GET {SUPABASE_URL}/rest/v1/sellers` | `401/[]` (avval `credits` chiqar edi); `public_sellers` — faqat 4 ustun |
| 20 | Eski Telegram foydalanuvchi (`legacy_…`) bilan login | `401 invalid_credentials` |

### 7.4. Qo'lda (brauzer) — `npm run dev`
Viewportlar: **320, 360, 390, 430, 768, 1024, 1280 px**; brauzer zoom **200%** (gorizontal skroll bo'lmasin); Chrome DevTools → iPhone 14 Pro (notch, `safe-area`); klaviaturasiz (Tab) o'tish.

Auth:
- [ ] Toza brauzer (localStorage bo'sh) → `/auth`, «Ro'yxatdan o'tish» tanlangan; boshqa har qanday URL ham `/auth`ga qaytaradi.
- [ ] Rol tanlanmasdan yuborish → xato; rol → «Avto-servis egasi» → servis maydonlari 200ms ochiladi; qaytib «Oddiy» → yopiladi, kiritilgan qiymatlar yuborilmaydi.
- [ ] Login band → 400ms dan keyin xato; to'g'ri format → yashil belgi.
- [ ] Parol ko'rsatish tugmasi 48×48; ekran o'quvchi «Parolni ko'rsatish» deydi.
- [ ] Ro'yxatdan o'tish → darhol kirilgan: `user` → `/`, `seller` → `/seller`.
- [ ] Sahifani yangilash (F5) — sessiya saqlanadi; ikkinchi tabda chiqish → birinchi tab ham `/auth`ga o'tadi.
- [ ] Chiqish → `/auth`; Orqaga tugmasi himoyalangan sahifani ochmaydi; Studio holati (mashina) keyingi kirgan foydalanuvchiga ko'rinmaydi.
- [ ] `user` `/seller`ni qo'lda ochsa → `/`; `seller` `/cart`ni ochsa → `/seller`.
- [ ] Noto'g'ri parol 6 marta → hisoblagich, tugma bloklanadi.

Piksel (DevTools → Computed / o'lchash):
- [ ] Input balandligi aynan **48px**, tugma `lg` **56px**, `sm` **44px**; barcha interaktiv elementlarning hit-area ≥ 44×44.
- [ ] iPhone'da oxirgi kontent nav ustida 16px bo'sh joy bilan tugaydi; CTA paneli nav'ga **0px** tirab turadi (teshik ham, ustma-ust tushish ham yo'q).
- [ ] Inputga fokus qilinganda iOS/Chrome-mobile sahifani zoom qilmaydi.
- [ ] Placeholder/hint kontrasti ≥ 4.5:1 (DevTools Contrast).
- [ ] `oʻ`, `gʻ` harflari Inter bilan to'g'ri ko'rinadi (tizim shriftiga tushmaydi).
- [ ] 1280px da Seller: sidebar aniq 240px, kontent ≤ 1120px, mahsulot qatori 72px.
- [ ] Modal: Esc yopadi, Tab tuzoqda, orqa sahifa skroll qilmaydi.

Seller oqimi:
- [ ] Yangi seller → bo'sh holat onboarding → «Yangi mahsulot» → saqlash → ro'yxatda; mijoz akkauntida katalogda ko'rinadi (yangi tab/inkognito).
- [ ] Mijoz buyurtma beradi → seller `/seller/orders`da 30s ichida ko'radi → status o'zgartiradi → bekor qilsa ombor qaytadi.
- [ ] Kredit: 0 bo'lsa generatsiya tugmasi «Kredit yetarli emas»; prod rejimda «Sotib olish» ishlamaydi va tushuntirish ko'rsatadi.

### 7.5. Qabul mezonlari (Definition of Done)
1. Kodda `telegram`, `initData`, `tma`, `TELEGRAM_`, `ALLOW_INSECURE_AUTH` so'zlari **qolmagan** (`grep -ri` bilan; tarixiy migratsiya fayli bundan mustasno).
2. 7.1 buyruqlari xatosiz; smoke skriptidagi 20 ta holatning hammasi o'tadi.
3. Hech bir API javobda `password_hash` yo'q (testda qulflangan).
4. 5.3–5.5 dagi o'lchamlar DevTools'da tasdiqlangan; 7.4 ro'yxati to'liq belgilangan.
5. README va `.env.example` yangi oqimni aks ettiradi.

---

## 8. Xavflar va ochiq savollar

| Xavf | Yumshatish |
| --- | --- |
| Tiklash yo'q → foydalanuvchi parolni unutsa akkaunt yo'qoladi | Ro'yxatdan o'tishda ogohlantirish bloki (5.3); parol takrori; 4-bosqichdan keyin tiklash (SMS/email) alohida reja |
| Eski Telegram foydalanuvchilarining buyurtmalari egasiz qoladi (`legacy_*`) | Ma'lumot saqlanadi (yaxlitlik buzilmaydi); istasangiz `legacy_*` ga qo'lda parol berib bog'lash mumkin |
| scrypt CPU yuki (~250–500 ms) serverless'da | Rate limit (4.6); kerak bo'lsa `p` ni kamaytirish, `needsRehash` bilan yangilash |
| `localStorage` tokeni XSS'da o'qiladi | Qat'iy CSP (`default-src 'self'`, rasm uchun Supabase hosti) va React'ning avto-escape'i; keyin `httpOnly` cookie (bir domen bo'lsa) |
| Rate limit DB'ga yozuv qo'shadi (yuk) | Faqat `auth` endpointlarida; indekslar va davriy tozalash (3.3) |
| Vercel'da yuklash limiti ~4.5MB | Klient `resizeImage` (mavjud) + server rad xabari aniq (S21) |

**Reja doirasida qabul qilingan taxminlar:** login katta-kichik harfga sezgir emas (kichikka keltiriladi); bitta foydalanuvchi = bitta rol; servis egasi mijoz katalogidan xarid qila olmaydi (faqat mahsulotni ko'rish); telefon formati seller uchun qat'iy `+998`.

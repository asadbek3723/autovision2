# CarVision

AI Car Customization + Tuning Parts Marketplace — Telegram Mini App MVP.

Foydalanuvchi avtomobili rasmini yuklaydi, AI tuning o'zgarishlarini aynan shu
avtomobilda ko'rsatadi, so'ng mos keladigan real ehtiyot qismlarni marketplace
orqali topadi va buyurtma beradi.

```
Upload → AI Customize → Visualize → Find Parts → Calculate Price → Order → Installation
```

## Tuzilma

```
apps/
  api/      Fastify backend — auth, upload, AI generation, marketplace, order, seller
  web/      React + Vite Telegram Mini App
packages/
  shared/   Umumiy tiplar, customization katalogi va AI prompt qurilishi
supabase/
  schema.sql                 Yagona sxema fayli — jadvallar, RLS, storage, demo maʼlumotlar
scripts/
  db-push.mjs                schema.sql'ni Supabase'ga qo'llaydi
```

## Texnologiyalar

| Qatlam | Tanlov |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 (CSS-first design tokens) |
| State | Zustand (studio sessiyasi) + React Query (server state) |
| Telegram | Telegram Mini Apps SDK (`telegram-web-app.js`) |
| Backend | Node.js + TypeScript + Fastify |
| DB / Storage | Supabase PostgreSQL + Supabase Storage |
| AI | image-to-image / image editing API (Gemini, OpenAI yoki mock) |

## Ishga tushirish

### 1. Bogʻliqliklar

```bash
npm install
```

### 2. Muhit oʻzgaruvchilari

```bash
cp .env.example .env
```

`.env` da toʻldirish kerak boʻlganlar:

| Oʻzgaruvchi | Qayerdan olinadi |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API |
| `AI_PROVIDER` | `mock` (kalitsiz), `gemini` yoki `openai` |

`TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` ixtiyoriy — faqat Telegram Mini
App yoki Login Widget orqali kirishni yoqmoqchi bo'lsangiz kerak (pastga
qarang). Ular bo'lmasa ham `ALLOW_INSECURE_AUTH=true` bilan sayt to'liq ishlaydi.

`AI_PROVIDER=mock` boʻlsa butun oqim API kalitlarsiz ishlaydi — mock provider
original rasmni qaytaradi, shuning uchun marketplace, savat va order qismlarini
AI hisobisiz sinash mumkin.

### 3. Baza

```bash
npm run db:push
```

`DATABASE_URL` `.env` da bo'lsa (Supabase > Project Settings > Database >
Connection string > URI), skript `supabase/schema.sql` ni `pg` paketi orqali
to'g'ridan-to'g'ri qo'llaydi — alohida `psql` o'rnatish shart emas.

`DATABASE_URL` yo'q bo'lsa, `supabase/schema.sql` ni qo'lda Supabase SQL
Editor'ga joylashtirib Run bosing. Fayl idempotent — qayta ishga tushirsangiz
ham xato bermaydi, storage bucket (`carvision`) ham shu bilan yaratiladi.

### 4. Dev serverlar

```bash
npm run dev
```

- API: http://localhost:8787 (`/health` — tekshirish uchun)
- Web: http://localhost:5173

Brauzerda ochilganda `ALLOW_INSECURE_AUTH=true` tufayli test foydalanuvchi bilan
ishlaydi — Telegram bot yoki Mini App kerak emas, to'g'ridan-to'g'ri
`http://localhost:5173` linkidan kirib ishlatavering.

## API

| Method | Endpoint | Tavsif |
| --- | --- | --- |
| GET | `/api/me` | Foydalanuvchi + sotuvchi profili |
| PATCH | `/api/me` | Ism va telefonni yangilash |
| POST | `/api/cars` | Avtomobil rasmini yuklash (multipart) |
| POST | `/api/generations` | AI customization |
| GET | `/api/generations` | Konfiguratsiyalar tarixi |
| GET | `/api/categories`, `/api/vehicle-models` | Katalog maʼlumotlari |
| GET | `/api/products` | `categories`, `vehicle_model_id`, `search` filtrlari |
| GET | `/api/products/:id` | Mahsulot sahifasi |
| GET/POST/PATCH/DELETE | `/api/cart`, `/api/cart/items` | Savat |
| POST/GET | `/api/orders` | Buyurtma |
| GET | `/api/seller/stats`, `/api/seller/products`, `/api/seller/orders` | B2B dashboard |
| PATCH | `/api/seller/orders/:id` | Status: New → Accepted → Installing → Completed |

Autentifikatsiya: `Authorization: tma <initData>` (Telegram Mini App) yoki
`Authorization: Bearer <token>` (brauzer sessiyasi, Login Widget orqali
kirilganda). Backend Telegram imzosini HMAC-SHA256 bilan tekshiradi.

## Studio konfigurator

Studio ekrani mobil konfigurator sifatida qurilgan: yuqorida avtomobil rasmi,
pastda kuzov qismlari doki.

- **Bo'limlar qatori** — Oldi bamper, Orqa bamper, Yon qanotlar, Oynalar,
  Disklar, Shinalar, Spoyler, Faralar, Orqa chiroqlar, Rang/wrap, Salon.
  Yon tomonga suriladi; tanlov qilingan bo'lim nuqta bilan belgilanadi.
- **Variantlar qatori** — faqat ochiq bo'limning variantlari, yon tomonga
  suriladi. Birinchi karta "Yo'q" — tanlovni bekor qiladi.
- Bo'lim ↔ marketplace kategoriyasi bog'lanishi
  [customization.ts](packages/shared/src/customization.ts) da: AI natijasidan
  keyin aynan shu kategoriyalardagi mahsulotlar chiqadi.

## Design system

Reja 17–23-bo'limlariga muvofiq — minimalistic, premium automotive:

- Asosiy radius **16px**, spacing **8px grid** (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64)
- Neutral base palette + bitta brand accent; semantic ranglar faqat oʻz maʼnosida
- Emoji UI elementi sifatida ishlatilmaydi — professional SVG icon set
- Gradient, neon, glassmorphism va dekorativ effektlardan qochilgan
- Rang yagona belgi emas: tanlangan/mos holatlar ikonka va matn bilan ham beriladi

Tokenlar `apps/web/src/index.css` dagi `@theme` blokida.

## Demo ssenariysi

1. Sayt linki brauzerda ochiladi
2. Cobalt rasmi yuklanadi, model tanlanadi
3. Disk + tonirovka + spoyler tanlanadi
4. Generate → original/natija taqqoslash
5. "Mahsulotlar" → tanlangan kategoriyalar va modelga mos mahsulotlar
6. Savat → narx → buyurtma
7. Sotuvchi kabinetida yangi buyurtma va status oʻzgarishi

## Sotuvchi kabineti va AI kredit

Sotuvchi kabinetida to'liq boshqaruv mavjud: mahsulot qo'shish/tahrirlash/
o'chirish (rasm yuklash bilan), biznes profilini tahrirlash va AI kredit
balansi (`/seller/credits`). Sotuvchi shu yerda o'z mahsulotini AI bilan
namoyish qiluvchi rasm yaratishi mumkin — har chaqiruv 1 kredit sarflaydi
(100 kredit = $20). Yangi sotuvchiga 3 ta bepul kredit beriladi. Kredit sotib
olish hozircha **mock to'lov** — real Payme/Click keyinroq shu joyga ulanadi.

## Brauzerdan kirish (ixtiyoriy Telegram Login Widget)

Sayt hech qanday Telegram bot yoki Mini App'siz, oddiy link orqali ham to'liq
ishlaydi — `ALLOW_INSECURE_AUTH=true` bilan brauzerda ochilganda avtomatik
test foydalanuvchi bilan kiradi. Production'da real foydalanuvchilar uchun
ikkita variant bor:

- **Hech narsa sozlamasdan** — `ALLOW_INSECURE_AUTH` production'da
  ishlatilmaydi (xavfsizlik uchun taqiqlangan), shuning uchun bu holatda
  `/login` sahifasi ko'rinadi va `VITE_TELEGRAM_BOT_USERNAME` sozlanmagani
  haqida xabar beradi — Telegram bot kerak bo'lmasa, boshqa login usulini
  (masalan email/parol) qo'shish kerak bo'ladi.
- **Telegram Login Widget yoqish** — `.env`da `TELEGRAM_BOT_USERNAME` va
  `apps/web/.env`da `VITE_TELEGRAM_BOT_USERNAME` (bot foydalanuvchi nomi,
  `@`siz) ko'rsating, so'ng BotFather'da `/setdomain` orqali domeningizni
  botga bog'lang.

## MVP doirasi

Kiritilgan: Mini App, rasm yuklash, AI customization, moslik, marketplace,
savat, order, minimal seller dashboard, design system.

Kiritilmagan: online toʻlov, yetkazib berish, murakkab recommendation engine,
toʻliq inventory management, native ilova.

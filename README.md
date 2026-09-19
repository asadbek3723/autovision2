# CarVision

AI Car Customization + Tuning Parts Marketplace — web ilova (login/parol bilan).

> Deploy: [DEPLOY.md](DEPLOY.md)

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
  web/      React + Vite web ilova
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
| Auth | Login + parol (scrypt), server tomonda saqlanadigan sessiyalar, rollar: foydalanuvchi / servis egasi |
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

`SUPABASE_SERVICE_ROLE_KEY` ga **secret** kalit (`sb_secret_...`) qo‘yiladi — publishable/anon kalit xavfsiz emas.

`AI_PROVIDER=mock` boʻlsa butun oqim API kalitlarsiz ishlaydi — mock provider
original rasmni qaytaradi, shuning uchun marketplace, savat va order qismlarini
AI hisobisiz sinash mumkin.

### 3. Baza

Supabase > SQL Editor da `supabase/migrations/` fayllarini nomi bo‘yicha tartib bilan bajaring (yoki `.env` ga `DATABASE_URL` yozib `npm run db:migrate`). Migratsiyalar takroran ishga tushirilsa ham xato bermaydi.

`supabase/schema.sql` faqat **bo‘sh dev bazani** noldan qurish uchun — u barcha jadvallarni o‘chiradi, production’da ishlatmang.

### 4. Dev serverlar

```bash
npm run dev
```

- API: http://localhost:8787 (`/health` — tekshirish uchun)
- Web: http://localhost:5173

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

Autentifikatsiya: `Authorization: Bearer <token>` (token `POST /api/auth/login` yoki `/api/auth/register` javobida keladi; serverda xeshlanib saqlanadi va logout’da bekor qilinadi).

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

## MVP doirasi

Kiritilgan: Mini App, rasm yuklash, AI customization, moslik, marketplace,
savat, order, minimal seller dashboard, design system.

Kiritilmagan: online toʻlov, yetkazib berish, murakkab recommendation engine,
toʻliq inventory management, native ilova.

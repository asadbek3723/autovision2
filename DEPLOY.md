# CarVision — Vercel'ga deploy qilish

Bitta GitHub repodan **ikkita Vercel loyiha** yaratiladi: **API** (`apps/api`) va **Web** (`apps/web`). Baza va rasmlar — Supabase.

```
Brauzer ──► Web (Vercel, statik)  ──VITE_API_URL──►  API (Vercel, serverless)  ──►  Supabase (Postgres + Storage)
```

## 0. Boshlashdan oldin (bir marta)

1. **`.env` faylini git'ga qo'shmang.** U `.gitignore` da. Agar `.env` allaqachon commit qilingan bo'lsa (`git log --stat` da ko'rinsa), ichidagi **barcha kalitlarni almashtiring** (Supabase, Gemini, OpenAI) va tarixdan olib tashlang.
2. **Supabase SECRET kalitini oling:** Supabase > Project Settings > API Keys > **Secret key** (`sb_secret_...`). Backend faqat shu kalit bilan xavfsiz ishlaydi. Publishable (`sb_publishable_...`) kalit **bilan ishlatmang** — `/health` buni ogohlantiradi.
3. **Migratsiyalarni qo'llang** (Supabase > SQL Editor, tartib bilan, har birini alohida Run):
   1. `supabase/migrations/20260918_0001_login_password_auth.sql` (bazada allaqachon bo'lsa, qayta ishga tushirish xavfsiz)
   2. `supabase/migrations/20260918_0002_lock_down_rls.sql` — **avval 2-qadamdagi secret kalitni Vercel'ga qo'ying**, aks holda login ishlamay qoladi (bu migratsiya anon kalitning `users`/`sessions` jadvallariga kirishini yopadi).
   - `supabase/schema.sql` ni **production'da ishga tushirmang** — u barcha jadvallarni o'chiradi.

## 1. API loyihasi (Vercel)

Vercel > **Add New > Project** > repoyni tanlang:

| Sozlama | Qiymat |
| --- | --- |
| Root Directory | `apps/api` |
| Framework Preset | Other |
| Build Command | (`vercel.json` dan: `npm run build:vercel`) |
| Install Command | standart (Vercel workspace'ni o'zi aniqlaydi) |
| "Include source files outside of the Root Directory" | **yoqilgan** (standart) |

**Environment Variables** (Production va Preview):

| O'zgaruvchi | Qiymat |
| --- | --- |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** kalit (`sb_secret_...`) |
| `SUPABASE_STORAGE_BUCKET` | `carvision` |
| `WEB_APP_URL` | Web loyihaning to'liq manzili, oxirida `/`siz: `https://autovision2.vercel.app` (bir nechta bo'lsa vergul bilan) |
| `AI_PROVIDER` | `gemini` (yoki `mock` — natija asl rasm bo'ladi, o'zgarish ko'rinmaydi) |
| `GEMINI_API_KEY` | AI uchun (`AI_PROVIDER=gemini` bo'lsa) |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` |
| `PAYMENTS_MODE` | `off` |

`NODE_ENV` ni Vercel o'zi `production` qiladi.

**Tekshirish:** deploy tugagach

```
curl https://<api-loyiha>.vercel.app/health
```

`{"ok":true,...}` chiqishi kerak. `problems` ro'yxatida faqat kerakli ogohlantirishlar bo'ladi (qiymatlar hech qachon chiqmaydi).

## 2. Web loyihasi (Vercel)

| Sozlama | Qiymat |
| --- | --- |
| Root Directory | `apps/web` |
| Framework Preset | Vite |
| Build Command | standart (`npm run build`) |
| Output Directory | `dist` |

**Environment Variables:**

| O'zgaruvchi | Qiymat |
| --- | --- |
| `VITE_API_URL` | API loyihaning to'liq manzili, oxirida `/`siz: `https://<api-loyiha>.vercel.app` |

> `VITE_*` qiymatlar **build vaqtida** kiritiladi: o'zgartirgach Web loyihani **Redeploy** qiling.

Kamera va harakat sensori faqat **HTTPS** da ishlaydi — Vercel domenlari HTTPS.

## 3. Deploydan keyingi sinov

- [ ] `https://<api>/health` → `ok: true`
- [ ] `https://<api>/api/categories` → kategoriyalar ro'yxati
- [ ] Web'da ro'yxatdan o'tish → kirish → Profil > Chiqish
- [ ] Studio > Kamerani ochish (telefonda, HTTPS): mashina detektori yuklanadi
- [ ] Brauzer DevTools > Network: so'rovlar `VITE_API_URL` ga ketyapti, CORS xatosi yo'q

## Muammolar

| Belgi | Sabab va yechim |
| --- | --- |
| API `503 misconfigured` | Environment Variables yetishmayapti — javobdagi `problems` ro'yxatida qaysilari ko'rsatilgan. O'zgartirgach **Redeploy**. |
| API `500 FUNCTION_INVOCATION_FAILED` | Vercel > Deployments > Functions > **Logs**. Odatda build (`build:vercel`) muvaffaqiyatsiz bo'lgan (Root Directory `apps/api` ekanini tekshiring). |
| API `404 NOT_FOUND` (`/api/...`) | Root Directory noto'g'ri (repo ildizi emas, `apps/api` bo'lishi kerak) yoki `apps/api/vercel.json` deploy'ga kirmagan. |
| Brauzerda `CORS` xatosi | API'dagi `WEB_APP_URL` Web domenidan farq qiladi (`http`/`https`, oxirida `/`, `www`). |
| Web'da hamma so'rov xato | `VITE_API_URL` berilmagan yoki noto'g'ri; o'zgartirgach Web'ni qayta deploy qiling. |
| Login ishlamaydi (0002 dan keyin) | `SUPABASE_SERVICE_ROLE_KEY` ga secret kalit qo'yilmagan (publishable qolgan). |
| Rasm yuklash `413`/xato | Vercel funksiyasi so'rov hajmi ~4.5 MB bilan cheklangan; klient rasmni avtomatik kichraytiradi, juda katta fayl rad etiladi. |
| Studio natijasida o'zgarish ko'rinmaydi | `AI_PROVIDER=mock`. `gemini` va `GEMINI_API_KEY` ni qo'ying. |

## Lokal ishga tushirish

```bash
cp .env.example .env      # SUPABASE_URL va SECRET kalitni to'ldiring
npm install
npm run dev               # API :8787, Web :5173
npm run typecheck && npm test -w @carvision/web
```

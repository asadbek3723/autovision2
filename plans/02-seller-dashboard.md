# CarVision — Seller Dashboard: to'liq reja (mahsulot qo'shish, katalog izolyatsiyasi, dizayn, animatsiya)

> Versiya 1.0 · 2026-09-18 · Til: o'zbek (lotin)
> Bog'liq: [01-auth-roles-seller-panel.md](01-auth-roles-seller-panel.md) (login/parol, rollar). Bu reja unga **tayanadi** va ba'zi qoidalarini **almashtiradi** (1.4-bo'limga qarang).

---

## 0. Holat va maqsad

**Halol holat:** hali **hech narsa qurilmagan** — 01-reja ham, bu reja ham faqat hujjat. Hozirgi seller sahifasi (`SellerPage.tsx`, 410 qator) — 4 tabli oddiy mobil sahifa: 4 ta raqam kartasi, buyurtma ro'yxati, mahsulot ro'yxati va bitta modal forma. Grafik yo'q, rasm galereyasi yo'q, kompyuter uchun layout yo'q, katalog izolyatsiyasi yo'q.

**Maqsad (bugungi demo):** seller dashboard **ishlaydigan va juda chiroyli** bo'lsin; eng muhimi — **mahsulot qo'shish** oqimi mukammal (galereya, jonli ko'rinish, validatsiya, tezkor tahrir).

**Tasdiqlangan qarorlar**
| Savol | Qaror |
| --- | --- |
| Servis egasi o'z katalogida savatga qo'sha oladimi | **Yo'q — faqat vitrina.** Mijoz ko'zi bilan ko'radi, lekin savat/buyurtma tugmasi yo'q. |
| Mahsulot rasmi | **5 tagacha galereya** (`product_images`), drag&drop, tartiblash, asosiy rasm. |

---

## 1. Yangi biznes qoidasi: katalog izolyatsiyasi (eng muhim talab)

> **Servis egasi** mashinani vizuallashtirsa ham, katalogga kirsa ham — **faqat va faqat o'zi qo'shgan mahsulotlarni** ko'radi.
> **Oddiy foydalanuvchi** — **hamma do'konlarning hamma mahsulotini** ko'radi (Studio natijasida ham, katalogda ham).

### 1.1. Qoida server tomonda majburlanadi (UI'ga ishonilmaydi)
| Joy | Oddiy foydalanuvchi / mehmon | Servis egasi |
| --- | --- | --- |
| `GET /api/products` | hamma faol mahsulotlar | **`seller_id = o'zi` majburan** (mijoz yuborgan `seller_id` e'tiborsiz) |
| `GET /api/products/:id` | har qanday faol | faqat **o'zinikiga** ruxsat; boshqaniki → `404` (mavjudligini ham oshkor qilmaydi) |
| `GET /api/categories` | hamma kategoriya + **faol mahsulot soni (butun bozor)** | hamma kategoriya + **faqat o'z mahsulotlari soni** |
| Studio natijasi «Shu konfiguratsiya uchun» | hamma mos mahsulotlar | faqat o'zinikilar (bir xil endpoint → avtomatik) |
| `POST /api/cart/items`, `/api/orders` | ✅ | ❌ `403 wrong_role` |

Amalga oshirish: `optionalAuth(request)` (`lib/auth.ts`) — token bo'lsa foydalanuvchini aniqlaydi, yo'q/yaroqsiz bo'lsa mehmon (=hamma mahsulot). `catalog.ts` da `const scopeSellerId = user?.role === 'seller' ? seller.id : null` va so'rovga `.eq('seller_id', scopeSellerId)` majburan qo'shiladi. `seller.id` ni topish uchun sessiya so'rovi `sellers(id)` ni ham birga qaytaradi (qo'shimcha DB so'rovisiz).

### 1.2. Servis egasi uchun UI o'zgarishlari
- **Studio** (`/`, `/capture*`, `/result`): to'liq ishlaydi (mashina rasmga olish, konfigurator, generatsiya — foydalanuvchi bilan bir xil, kunlik limit ham).
- **Natija sahifasi** bo'limi: sarlavha «**Sizning mahsulotlaringiz**» (mijozda: «Shu konfiguratsiya uchun»). Agar tanlangan kategoriyada mahsuloti yo'q bo'lsa — **bo'sh holat + amal**: «Bu kategoriyada (Disklar) sizda hali mahsulot yo'q» + tugma **«Mahsulot qo'shish»** → `/seller/products/new?category=wheels` (kategoriya oldindan tanlangan). Bu demoda «Studio → mahsulot» ulanishini ko'rsatadigan kuchli lahza.
- **Katalog** (`/market`): sarlavha «**Mening vitrinam**»; kategoriya chiplari faqat mahsuloti bor kategoriyalar (soni bilan: `Disklar · 3`); kartada sotuvchi nomi o'rniga holat belgisi (`Faol` / `Kam qoldi` / `Tugagan`); tepada 44px «Vitrina rejimi — mijozlar shunday ko'radi» ma'lumot chizig'i (`info` ikoni).
- **Mahsulot sahifasi** (`/product/:id`): «Savatga qo'shish» o'rniga pastki panelda ikki tugma: **«Tahrirlash»** (`/seller/products/:id`) va ikkilamchi **«Vitrinaga qaytish»**. Yuqorida `Badge accent` «Mijoz ko'rinishi».
- **Navigatsiya** (seller): **Panel · Mahsulotlar · Buyurtmalar · Studio · Profil** (5 band; `Katalog`/vitrina — Mahsulotlar sahifasidagi «Ro'yxat | Vitrina» almashtirgich va Studio natijasi orqali). Savat/Buyurtmalarim yo'q.
- Cache kalitlari rolga bog'liq: `['products', scope, …]`, `scope = 'seller:<id>' | 'all'`; logout'da `queryClient.clear()` (01-reja) — rol almashganda eski ro'yxat ko'rinib qolmaydi.

### 1.3. Bo'sh holat (yangi servis egasi, 0 mahsulot)
Studio natijasi va vitrina — bezakli bo'sh holat: illyustratsiya (kategoriya ikoni, 56×56 plitka), «Sizda hali mahsulot yo'q», tavsif «Birinchi mahsulotni qo'shing — u mijozlar katalogida va Studio natijalarida ko'rinadi», CTA `Button lg` **«Mahsulot qo'shish»**.

### 1.4. 01-rejaga o'zgartirishlar (bu reja ustuvor)
| 01-rejadagi qoida | Yangi |
| --- | --- |
| Servis egasi `/`, `/capture`, `/result`, `/market` ga kira olmaydi | **Kira oladi** (yuqoridagi izolyatsiya bilan) |
| `/api/cars`, `/api/generations` → `requireRole('user')` | → `requireRole('user','seller')` |
| Seller nav: Panel, Mahsulotlar, Buyurtmalar, Profil | + **Studio** (5 band) |
| Ruxsat matritsasi 2.2 | `/cart`, `/checkout`, `/orders`, `POST /api/cart*`, `POST /api/orders` — **faqat `user`**; qolgan Studio/Katalog/Mahsulot — `user` va `seller` |
| Login keyin seller → `/seller` | o'zgarmaydi (bosh sahifa — Panel) |

---

## 2. Bugungi demo uchun ustuvorlik va vaqt (halol baho)

Umumiy ish katta; bugun ko'rsatish uchun **kesish chizig'i** belgilandi. Baholar — bir kishi uchun sof kod vaqti, sinovsiz.

| Bosqich | Mazmun | Vaqt | Demo uchun |
| --- | --- | --- | --- |
| **A. Poydevor (01-rejadan minimal)** | Migratsiya (login/parol, `sessions`, `sellers` RLS), `register/login/logout/me`, rol guard'lar, `AuthPage`, `haptics` almashtirish, Telegram olib tashlash | 2–2.5 s | **Shart** |
| **B. Katalog izolyatsiyasi** | `optionalAuth`, `catalog.ts` scoping, `categories` soni, Result/Market/Product sahifa o'zgarishlari, seller nav | 1 s | **Shart** |
| **C. Seller shell + Dashboard** | `SellerShell`, KPI, grafik, holat barlari, «e'tibor» ro'yxati, top mahsulotlar, `seller_dashboard` SQL | 2 s | **Shart** |
| **D. Mahsulotlar + Muharrir** | Ro'yxat/jadval, qidiruv/filtr, tezkor tahrir, **muharrir sahifa**, galereya, jonli ko'rinish, kategoriya panjarasi, moslik tanlagich | 3 s | **Shart (asosiy ko'rsatuv)** |
| **E. Buyurtmalar** | Filtr chiplari, karta, tafsilot drawer, mijoz kontakti, status oqimi + ombor qaytishi | 1.2 s | Shart |
| **F. Animatsiya va sayqal** | Reveal, count-up, chart chizilishi, hover, drawer/toast, skeleton, bo'sh holatlar | 1.5 s | Shart (go'zallik talabi) |
| **G. Demo ma'lumot** | `seed-demo-accounts`, `seed-demo-orders` (45 kunlik tarix), rasm-plitkalar | 0.7 s | **Shart** |
| **H. Sinov va sayqal** | Smoke skript, 320–1440px sinov, kontrast/piksel tekshiruv, repetitsiya | 1 s | Shart |
| *I. Kredit sahifasi qayta dizayni, buyurtma tarixi (timeline), ommaviy amallar, nusxa olish* | | 1.5 s | Vaqt qolsa |

**Jami ≈ 12–13 soat.** Agar bugun kamroq vaqt bo'lsa — **kesish tartibi** (oxiridan boshlab tashlanadi): I → F ning count-up/stagger'i (asosiy hover/drawer qoladi) → E dagi timeline/drawer (oddiy karta qoladi) → D dagi drag-reorder (o'q tugmalari qoladi) → C dagi «Top mahsulotlar». **Hech qachon kesilmaydi:** A, B, D ning muharriri va galereyasi, G (bo'sh dashboard demoda o'ladi).

> **Eslatma (01-rejadan bugunga qoladiganlar):** parol kuchi o'lchagichi, `login-available` tekshiruvi, `login_attempts` rate limit, `check-copy` skripti, vitest testlari — **A bosqichida qisqartiriladi** (parol xeshi, sessiya, oddiy 5-urinish limiti qoladi), qolgani demo'dan keyin.

---

## 3. Axborot arxitekturasi va marshrutlar

```
/seller                  Panel (dashboard)
/seller/products         Mahsulotlar: [Ro'yxat | Vitrina]
/seller/products/new     Yangi mahsulot (muharrir)          ?category=<slug> oldindan tanlash
/seller/products/:id     Tahrirlash (muharrir)
/seller/orders           Buyurtmalar (+ ?order=<id> tafsilot drawer)
/seller/credits          AI kredit
/seller/profile          Servis profili + akkaunt
—— umumiy (izolyatsiyalangan) ——
/  /capture*  /result  /market  /product/:id
```

**Nima uchun muharrir modal emas, alohida sahifa:** chuqur havola, brauzer «orqaga», sahifani yangilaganda qoralama saqlanadi, ikki ustunli jonli ko'rinish uchun joy, mobilda to'liq ekran (klaviatura bilan modal muammolari yo'q).

---

## 4. Dizayn tizimi — dashboard uchun kengaytma

Mavjud til saqlanadi (premium avtomobil, qora neytral asos, bitta accent `#2f6bff`, radius 16, 8px grid) — 01-rejadagi tuzatishlar (16px input, 44px target, line-height'lar, `text-subtle #7f868f`) **asos**. Ilova **faqat qorong'i** temada (yorug' tema yo'q — qaror shu; dataviz talabidagi «yorug'/qorong'i tanlangan» punkt qorong'i uchun bajariladi).

### 4.1. Qo'shimcha tokenlar (`@theme`)
| Token | Qiymat | Ishlatilishi |
| --- | --- | --- |
| `--color-surface-3` | `#23272c` | hover qatori, drawer ichki plitkalar |
| `--color-chart-grid` | `rgb(255 255 255 / 0.06)` | grafik gorizontal chiziqlari (1px, tekis) |
| `--color-chart-axis` | `rgb(255 255 255 / 0.14)` | grafik asosiy chizig'i |
| `--color-accent-wash` | `rgb(47 107 255 / 0.10)` | area to'ldirish (10%) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | kirish animatsiyalari |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | almashinuvlar |
| `--shadow-lift` | `0 12px 32px -12px rgb(0 0 0 / .6)` | drawer, dropdown, toast (kartalarda soya yo'q) |

Grafik seriyasi rangi = `--color-accent` `#2f6bff`. **Tekshirildi** (`validate_palette.js`, qorong'i, surface `#141619`): lightness band ✅ (OKLCH L 0.48–0.67), kontrast ≥ 3:1 ✅. Hover/urg'u `#4d86ff` — shu ham ✅. Bitta seriya → **legend qutisi yo'q** (sarlavha nimani ko'rsatishini aytadi).

### 4.2. Tipografiya (piksel)
| Rol | Spetsifikatsiya |
| --- | --- |
| **Hero raqam** (tushum; ko'rinishda **bitta**) | **48/52**, 650, `-0.03em`, **proportional** raqamlar (`tabular-nums` yo'q) — mobilda 40/44 |
| Stat tile qiymati | 28/32, 650, proportional |
| Sahifa sarlavhasi (`h1`) | 22/26 (mavjud `.t-h1`), desktopda 28/32 |
| Karta sarlavhasi | 17/22 600 |
| Jadval matni / ma'lumot qatori | 14/20 (`tabular-nums` **faqat** jadval ustunlarida) |
| Yorliq, izoh | 13/18 `text-muted`; mikro yorliq 12/16 (eng kichik) |
| Raqam formati | `1 400 000 so'm` (NBSP ming ajratgich), qisqa: `12,4 mln`, `840 ming`; foiz: `+12,4%` (belgi bilan) |
| Sana/vaqt | `Asia/Tashkent` (UTC+5) — `Intl.DateTimeFormat('uz-UZ', {timeZone:'Asia/Tashkent'})`; «bugun 14:32», «kecha», «12-sen» |

### 4.3. Ikonalar (SVG, 24×24, stroke 1.6, mavjud uslub) — yangi
`trending-up`, `trending-down`, `bell`, `image`, `pencil`, `copy`, `eye`, `eye-off`, `filter`, `more`(uch nuqta), `grip`(sudrash), `clock`, `tag`, `box`, `download`, `clipboard`, `info`, `phone`, `log-out`, `lock`, `list`, `layout-grid`, `star`. Emoji **ishlatilmaydi**.

### 4.4. Yangi UI primitivlari (`components/ui/`)
| Komponent | Spetsifikatsiya |
| --- | --- |
| **Switch** | Track `44×24` (`rounded-full`), thumb `20×20` (2px chetdan), yoqilganda `translateX(20px)`, 150ms; hit-area `44×44` (`before:` inset); `role="switch" aria-checked`; yoqilgan — `bg-accent`, o'chiq — `bg-border-strong`; **rangdan tashqari** holat belgisi yo'q (yorliq matni «Yoqilgan/O'chiq» yonida) |
| **Stepper** | `[−] 44×44 · qiymat (min-w 56, 16/24 center) · [+] 44×44`, umumiy `h-12 rounded-lg border`; ushlab tursa tezlashadi (400ms dan keyin 8/s) |
| **MoneyInput** | Fokusda xom raqamlar, blur'da `1 400 000`; o'ngda «so'm» (14/20 muted, `pr-16`); `inputMode="numeric"`; max `999 999 999` |
| **Toast** | 360px (mobilda `calc(100vw-32px)`), `min-h-14`, `p-4`, `rounded-lg`, `bg-surface-2 border`, `shadow-lift`; chapda holat ikoni 20px; joylashuvi: mobil — nav tepasida `bottom: calc(var(--nav-h)+12px)`, desktop — o'ng-pastki `24px`; 4s, hover'da to'xtaydi, `role="status"`; kirish 200ms (`translateY(8px)+fade`), chiqish 160ms |
| **Drawer** | o'ngdan, `w-[480px]` (mobilda to'liq ekran sheet), `shadow-lift`, kirish 220ms `--ease-out-expo`; Esc, fokus tuzog'i (01-reja 5.6) |
| **ConfirmDialog** | 01-rejadagi |
| **Segmented** | 01-rejadagi (`h-10`, ichki `h-8`? — dashboard filtrlarida `h-11` versiya) |
| **DateRangeChips** | «7 kun · 30 kun · 90 kun» — `Chip h-11`, tanlangan `check` ikoni bilan (rangdan tashqari belgi) |
| **StatTile** | 5.2 |
| **AreaChart / BarList / Sparkline** | 5.3 — o'zimiz yozgan inline SVG (kutubxonasiz) |
| **ProductPlaceholder** | Rasm yo'q mahsulot uchun: `surface-2` ustida kategoriya ikoni (32px, `text-subtle`) + yumshoq diagonal gradient (`135°, surface-2 → surface-3`); ProductImage'ning bo'sh holati (hozirgi generik `package` ikoni o'rniga) |
| **Skeleton** | mavjud `shimmer`; har ekran uchun **yakuniy layout o'lchamida** skeleton (CLS ≈ 0) |

### 4.5. Animatsiya tizimi
**Tamoyil:** faqat `transform` va `opacity` (layout animatsiyasi yo'q → 60fps), sekin emas, **e'tiborni o'zi tortmaydi**; hamma animatsiya `prefers-reduced-motion: reduce`da o'chadi (faqat ≤120ms fade qoladi).

| Nima | Davomiylik / easing | Tafsilot |
| --- | --- | --- |
| Sahifa almashinuvi | 240ms `--ease-out-expo` | kirish: `opacity 0→1` + `translateY(8px→0)`; chiqish yo'q (tez his) |
| Karta «reveal» (stagger) | 320ms, har biri **+40ms** kechikish, ko'pi bilan 8 ta | yangi `.cv-rise-sm` (mavjud `.cv-rise` 700ms — dashboard uchun sekin) |
| Raqam count-up | 700ms `easeOutExpo` | faqat **birinchi** yuklanishda (sessiya boshiga bir marta, `sessionStorage`); qiymat o'zgarganda 300ms; `aria-label`da yakuniy qiymat |
| Grafik chizig'i | 900ms | `stroke-dashoffset` (mavjud `cv-draw`), keyin area 400ms fade, end-dot 200ms scale `0→1` |
| Barlar | 500ms, har biri +50ms | `scaleX(0→1)` `transform-origin: left`, 4px yumaloq uch |
| Karta hover (faqat `hover:hover`) | 150ms | `translateY(-2px)` + `border-border-strong`; mobil — `:active` da `scale(.985)` 100ms |
| Jadval qatori hover | 120ms | `bg-surface-3` |
| Tugma bosilishi | 100ms | `scale(.985)` |
| Drawer / sheet | 220ms | 4.4 |
| Toast | 200 / 160ms | 4.4 |
| Ro'yxatga element qo'shilishi | 240ms | `opacity` + balandlik `grid-template-rows 0fr→1fr` |
| O'chirish | 200ms | fade + balandlik yig'ilishi; «Bekor qilish» toast 5s (ko'rinishda o'chadi, 5s dan keyin serverga) — ixtiyoriy I |
| Birinchi mahsulot saqlandi | 600ms | `check` ikoni chiziladi (`cv-draw`) + accent halqa `scale 1→1.4, opacity .5→0` |
| Segmented/tab indikator | 200ms | faol pill `translateX` bilan **suriladi** (sakramaydi) |
| Skeleton | mavjud shimmer 1.4s | — |

**Unumdorlik:** `will-change` faqat animatsiya paytida; `backdrop-filter` mobil'da yo'q; grafik SVG'ida 90 nuqtadan ko'p bo'lmaydi (90 kunlik diapazon = 90 nuqta); count-up `requestAnimationFrame`, unmount'da bekor qilinadi.

---

## 5. Ekranlar — piksel spetsifikatsiya

Belgilar: `px` — CSS piksel; Tailwind 1 birlik = 4px. Layout ko'rsatkichlari **1120px konteyner** uchun aniq (kengroq ekranlarda konteyner markazlanadi, kengaymaydi).

### 5.1. SellerShell (01-reja 5.4 ustiga aniqlashtirish)
- **< 1024px:** `Header` 56px (sarlavha + o'ngda amal) · pastki nav 5 band, `min-h-[var(--nav-h)]`; band eni ≥ 64px (390px'da 78px); ikonka 22px + yorliq 12/16; faol — `text-accent` + tepada 3px chiziq (mavjud til). «Buyurtmalar» ustida yangi buyurtma nishoni (`min-w-4 h-4 text-[10px]/16 bg-accent`, 9+).
- **≥ 1024px:** `grid-cols-[240px_1fr]`; sidebar `sticky top-0 h-dvh`, `bg-surface`, `border-r`, `p-4`; nav bandi `h-11 px-3 rounded-md gap-3`; faol — `bg-surface-2` + chap 3px accent. Pastda profil bloki (avatar 40×40, ism 14/20, `@login` 13/18) + «Chiqish». Kontent `max-w-[1120px] mx-auto px-8 py-8`; sahifa sarlavhasi qatori `h-11` + o'ngda asosiy amal.
- **Nav badge yangilanishi:** `GET /api/seller/counters` har **20s** (`refetchInterval`, faqat tab ko'rinib turganda) → yangi buyurtma bo'lsa toast «Yangi buyurtma #a1b2c3d4 — 1 250 000 so'm» + `document.title = '(2) CarVision'`.

### 5.2. Panel (Dashboard) — `/seller`

**Desktop (≥1280, konteyner 1120):**
```
┌ salom qatori ───────────────────────────── [7 kun][30 kun✓][90 kun] ┐  h-11
│ Xayrli kun, Sardor            13-sen — 12-okt                        │
├ Tushum (hero) ──────────────────────────────────┬ E'tibor talab ────┤
│ TUSHUM · 30 KUN                       736 × ~360│ qiladi   360px    │
│ 12 480 000 so'm   ▲ +18,4% o'tgan 30 kunga     │ ● 3 yangi buyurtma│
│ [area chart 240px balandlik]                    │ ● 2 ta kam qoldi  │
│                                                 │ ● 1 ta rasmsiz    │
├ stat ─ stat ─ stat ─ stat  (har biri 268px, gap 16) ──────────────┤
│ Yangi 3 │ Buyurtmalar 41 │ O'rtacha chek │ Faol mahsulot 12         │
├ Buyurtmalar holati (548px) ──────┬ Top mahsulotlar (548px) ────────┤
├ So'nggi buyurtmalar (1120px, jadval) ───────────────────────────────┤
```
Qator oralig'i `gap-6` (**24px**), stat-tile gridi `gap-4` (16px). Yuqori qatorda chap `minmax(0,1fr)` (1120−24−360 = **736px**) va o'ng **360px** aniq.

**Mobil (390px):** ustun, `px-4` (16), `gap-3` (12): salom (`t-h1`) → diapazon chiplari (gorizontal skroll, `-mx-4 px-4`) → hero karta → stat tile'lar 2×2 (`(390−32−12)/2 = 173px`) → «E'tibor talab qiladi» → holat barlari → top mahsulotlar → so'nggi buyurtmalar (kartalar).

**Hero karta:** `p-6` (mobil `p-4`), `rounded-lg border bg-surface`; ustki yorliq `13/18 text-muted` «Tushum · so'nggi 30 kun»; hero qiymat 48/52 (mobil 40/44) `mt-1`; yonida delta chip: `h-6 px-2 rounded-sm 13/18`, ikon (`trending-up`/`down` 14px) + `+18,4%` — yaxshi=`success`, yomon=`danger` **ikon+belgi bilan** (rangdan tashqari); ostida `13/18 text-subtle` «o'tgan 30 kun: 10 540 000 so'm». Grafik `mt-6`, balandlik 240px (mobil 180px). O'ng-yuqorida `Jadval` tugmasi (`aria-pressed`, `h-9→44px hit`) — jadval ko'rinishi.

**StatTile** (`p-4`, `rounded-lg border bg-surface`, `min-h-[112px]`): yorliq 13/18 muted; qiymat 28/32; pastda delta (12/16) va o'ngda **sparkline** `64×24` (12 nuqta, 2px chiziq `text-subtle`, oxirgi nuqta accent 8px + 2px surface halqa). «Yangi buyurtma» tile — accent chegara (`border-accent/40`) va bosilsa `/seller/orders?status=new`.

**«E'tibor talab qiladi»** — vazifa ro'yxati (bo'sh bo'lsa: `check` ikoni + «Hammasi joyida»): qator `min-h-[52px]`, chapda ikon plitka 32×32, matn 14/20, o'ngda `chevron-right`; bosilsa tegishli filtrlangan sahifa. Manbalar: 2 soatdan beri **qabul qilinmagan** yangi buyurtmalar; `stock ≤ 2` (kam), `stock = 0` (tugagan); **rasmsiz** mahsulotlar; kredit `< 3`.

**Buyurtmalar holati** (BarList): 5 qator (Yangi, Qabul qilingan, O'rnatilmoqda, Tugagan, Bekor); qator `h-11`: chapda status ikoni 16px + nom 14/20, o'ngda son (14/20 `font-medium`); bar `h-2`? — **spetsifikatsiya:** bar qalinligi **8px**, tekis chap (baseline), **o'ng uchi 4px yumaloq**, bitta rang (`accent`), trek `surface-2`; qiymat bar uchida; qatorlar orasi 8px. Status ma'nosi **yorliq+ikon** bilan (rang yagona belgi emas).

**Top mahsulotlar:** 5 qator `min-h-[56px]`: rasm 40×40 (`rounded-md`), nom (1 qator ellipsis) + «12 dona», o'ngda tushum (14/20 `tabular-nums`) va ostida ingichka meter (4px, eng yuqori 100%).

**So'nggi buyurtmalar:** ≥1024 jadval (`#id · mijoz · mahsulotlar soni · summa · status · vaqt`), qator `h-14`; mobil — 5 ta kompakt karta. «Hammasi» havolasi.

**Onboarding (yangi seller, 0 mahsulot):** dashboard o'rniga tepada **«Boshlaymiz» kartasi**: 3 qadam, har birida raqam/`check` belgisi va 44px tugma — ① Servis profilini to'ldiring (telefon, manzil) ② Birinchi mahsulotni qo'shing ③ Studioda AI bilan sinab ko'ring. Progress halqasi 56px (2/3). Qolgan kartalar skeleton emas, **nolli qiymat** bilan ko'rinadi (grafik: yassi asosiy chiziq + «Hali tushum yo'q»).

**Diapazon o'zgarganda:** ramka saqlanadi, kartalar `opacity .6` (refetch), skeleton yo'q (dataviz «refetch keeps the frame»).

### 5.3. Grafik komponentlari (kutubxonasiz, inline SVG) — dataviz qoidalari bo'yicha
**AreaChart (tushum, kunlik):**
- Chiziq **2px**, `round` join/cap, rang `--color-accent`; area — shu rang **10%** (`--color-accent-wash`), pastdan asosiy chiziqqa tayanadi.
- Oxirgi nuqta: **8px** aylana (r=4) accent + **2px surface halqa** (`#141619`).
- Gorizontal chiziqlar: **1px, tekis (dashed emas)**, `--color-chart-grid`; asosiy chiziq `--color-chart-axis`. Y ticklar: 0 · o'rta · max (yaxlitlangan «toza» sonlar: 0 / 2 mln / 4 mln), matn `12/16 text-subtle`; X ticklar ≤ 5 ta (`13-sen`, `20-sen`…).
- Bo'shliqlar: har kun nuqtasi bor (nol tushumli kunlar ham) — SQL `generate_series` bilan to'ldiriladi, aks holda grafik yolg'on egri chiziq beradi.
- **Hover/fokus:** vertikal hairline crosshair eng yaqin kunga «yopishadi»; **bitta tooltip**: sana (13/18 muted), tushum (**qiymat yetakchi**, 15/20 600), buyurtmalar soni; chiziq-kalit (qisqa 2px chiziq) bilan; `textContent` orqali (innerHTML yo'q). Hit-area — butun grafik balandligi (nuqtaga emas, X ga nishonlanadi).
- **Klaviatura:** grafik `tabindex=0`, ←/→ kunlar bo'ylab, Home/End; fokusda ham tooltip.
- **Jadval ko'rinishi:** `Jadval` tugmasi — `<table>` (sana, tushum, buyurtma soni); ekran o'quvchi uchun grafikda `role="img" aria-label="Tushum: 30 kunda 12 480 000 so'm, eng yuqori kun 2 100 000 (5-okt)"`.
- Cheklov: bitta seriya → legend yo'q; sarlavha nimani ko'rsatishini aytadi. Ikkinchi o'q (buyurtma soni) **yo'q** (dual-axis taqiqlangan) — buyurtma soni tooltip va stat tile'da.
- Nol/bir nuqta: yassi chiziq, tooltip ishlaydi; ma'lumot yo'q — `EmptyChart` («Hali tushum yo'q. Birinchi tugallangan buyurtmadan keyin shu yerda ko'rinadi.»).
- Kod hajmi: chart chunk ≤ 6 KB gzip (d3 yo'q; `pathData` qo'lda, `catmull-rom` emas — **to'g'ri chiziq** segmentlari, 90 nuqtada silliqlash kerak emas).

**BarList / Sparkline / Meter:** 5.2 dagi spetsifikatsiya (bar ≤ 24px qalinlik cheklovi qoidasiga mos: 8px).

### 5.4. Mahsulotlar — `/seller/products`
**Asboblar qatori** (bitta qator, kontent ustida; 01-reja/dataviz «filtrlar bitta qatorda»):
`[🔍 qidiruv flex-1 h-12]` `[Kategoriya ▾ h-12 w-[200px]]` `[Holat: Hammasi/Faol/Faol emas — Segmented h-11]` `[Ro'yxat | Vitrina — Segmented 2×44]` `[+ Yangi mahsulot — Button h-12]`. Mobilda: qidiruv (to'liq) → filtr chiplari (gorizontal) → FAB **56×56** o'ng-pastda (nav tepasida `bottom: calc(var(--nav-h)+16px)`, `right:16px`, `rounded-full`, `+` ikoni 24px, `cv-cta` gradient, soya `shadow-lift`).
**Mini KPI chiziq** (toolbar ostida, `h-16`, 4 ta ixcham ko'rsatkich): Jami · Faol · Kam qoldi · Tugagan (bosilsa filtrlaydi).

**Jadval (≥1024):** ustunlar (kenglik): tanlash checkbox `44` · Rasm `72` (56×56 rasm) · Nomi `flex` (15/20 500 + ostida kategoriya · moslik 13/18 muted) · Narx `140` (o'ngga) · Ombor `160` (raqam + 48×4 meter; ≤2 → `warning` matn «Kam qoldi»; 0 → «Tugagan») · Holat `112` (Switch faol/faol emas — **tezkor**) · Amallar `120` (`pencil`, `copy`, `more` — har biri 44×44). Sarlavha `h-11`, qator `h-[72px]`, `border-b`, hover `bg-surface-3`. **Tezkor tahrir:** narx yoki ombor katagini bosish → o'sha joyda input (`h-9`? — target 44px: qator ichida `h-11`), Enter saqlaydi, Esc bekor; **optimistik** yangilanish + xatoda orqaga qaytarish + toast.
**Kartalar (<1024):** rasm 72×72, nom, narx, ombor; pastda `Switch` va «⋯». Har karta 100% eni, `p-4`.
**Vitrina rejimi:** mijoz `ProductGrid` (2 ustun mobil / 4 ustun ≥1024, `gap-4`) — faqat faol mahsulotlar, mijoz ko'rinishi; kartaga bosilsa `/product/:id` (vitrina rejimi, 1.2).
**Saralash:** `Yangi · Narx ↑ · Narx ↓ · Ombor ↑` (`select h-12`). **Sahifalash:** server (`limit 24`), pastda «Yana yuklash» (infinite emas — bosqichma-bosqich); jami soni ko'rsatiladi.
**Bo'sh/xato:** qidiruv natijasi yo'q — «"X" bo'yicha topilmadi» + «Filtrlarni tozalash»; 0 mahsulot — 1.3.
**Ommaviy amallar** (I): checkbox tanlanganda pastdan `h-16` panel «3 ta tanlandi · Faolsizlantirish · Faollashtirish · O'chirish».

### 5.5. Mahsulot muharriri — `/seller/products/new` va `/:id` (asosiy ko'rsatuv)

**Layout (≥1024, konteyner 1120):** chapda forma **680px**, `gap-8` (32px), o'ngda **sticky jonli ko'rinish 408px** (`top-8`). Yuqorida sahifa sarlavhasi qatori: `← Mahsulotlar` (44px), «Yangi mahsulot», o'ngda **Saqlash** (primary `h-11`) va «Bekor qilish». **Mobil:** bir ustun; pastda **yopishqoq saqlash paneli** (`sticky bottom-0`, `h-[72px]`, `border-t bg-bg/95`, `px-4`, ichida `Button lg h-14`; nav yo'q shu sahifada — `hideNav`); jonli ko'rinish shakl oxirida yig'iladigan bo'lim.

**Bo'limlar** (har biri `Card p-6`, mobil `p-4`; sarlavha `t-h2 17/22` + qisqa izoh `13/18 muted`; bo'limlar orasi `gap-6`):

1. **Rasmlar** (5 tagacha)
   - 5 ta slot, har biri **120×120** (`rounded-lg`, `gap-3`=12 → jami 648px ≤ 680), mobilda `grid-cols-3` (390px'da 114×114). Birinchi slot **«Asosiy»** belgisi (`Badge accent` chapda-yuqorida, 12/16).
   - Bo'sh slot: `border-dashed border-border-strong`, ichida `image` ikoni 24px + «Qo'shish» 13/18; hover/drag-over: `border-accent bg-accent/8` + ikon 1.1× (150ms).
   - **Yuklash usullari:** bosish (fayl tanlash, `multiple`), **drag&drop** butun bo'lim ustiga, **Ctrl+V** (bufer), mobilda kamera/galereya. Bir vaqtda ≤ 2 parallel yuklash.
   - Har rasm: mijozda `resizeImage` (≤1600px, **WebP q .82**, JPEG fallback) → ≈300–900 KB → `POST /api/seller/products/images`; slot ustida progress halqasi (28px, `stroke-dashoffset`), tugagach `object-cover` rasm fade-in 200ms. Xato — slot ustida `danger` chegara + «Qayta urinish» (44px).
   - **Tartiblash:** pointer bilan sudrash (`grip` tutqich yuqori-o'ngda) **va** klaviatura/mobil uchun `←` `→` tugmalari (slot ostida ko'rinadi, 44×44; ekran o'quvchi: «2-rasm, 5 dan. Chapga siljitish»). Birinchi = asosiy rasm (kartochka muqovasi, `products.image_url`).
   - O'chirish: slot burchagida `×` (hit 44×44, ko'rinishi 24px `bg-bg/80`), tasdiqsiz (bekor qilish toast'i 5s).
   - Izoh: «JPG, PNG yoki WEBP · har biri 12 MB gacha (avtomatik kichraytiriladi). Birinchi rasm — asosiy.»
2. **Asosiy ma'lumot**
   - **Nomi** (2–120; hisoblagich `0/120` o'ngda 13/18) — `autoFocus` (yangi rejimda).
   - **Kategoriya** — `<select>` **emas**, **vizual panjara**: 13 ta plitka (ikon 24px + nom 14/20), mobil 2 ustun, ≥1024 3 ustun (680px'da `(632−2·12)/3 ≈ 202.7` → `grid-cols-[repeat(3,minmax(0,1fr))]`); plitka `min-h-14 (56px) p-3 rounded-lg border`; tanlangan — `border-accent bg-accent/12` + `check` 16px (rangdan tashqari belgi). `radiogroup`, ↑↓←→. `?category=` bo'lsa oldindan tanlangan.
   - **Brend** — input + `datalist` (avval kiritilgan brendlar).
   - **Tavsif** — `Textarea min-h-32`, `0/1000`, maslahat «Materiali, o'lchami, kafolat va o'rnatish vaqtini yozing».
3. **Narx va ombor** (2 ustun ≥640, gap 16): `MoneyInput` (Narx) · `Stepper` (Ombor, 0…99 999). Ostida **ma'lumot chizig'i**: «Mijozga ko'rinadi: **1 400 000 so'm**».
4. **O'rnatish xizmati:** `Switch` «O'rnatish xizmati mavjud»; yoqilsa (balandlik animatsiyasi 200ms) — `MoneyInput` «O'rnatish narxi» + izoh «Hozircha alohida kelishiladi — buyurtma summasiga qo'shilmaydi» (01-reja S18 aniqlik).
5. **Mos avtomobillar:** `Switch` **«Universal — barcha modellarga mos»** (yoqilsa ro'yxat yashirin). O'chiq bo'lsa: qidiruv (`h-12`) + brend bo'yicha guruhlangan chiplar (`Chip h-11`), har guruhda «Hammasi» tugmasi; tanlanganlar tepada olib tashlanadigan chiplar (× 44 hit). Hisoblagich «5 ta model tanlandi». *(Hozirgi noaniq mantiq — «bo'sh = universal» — endi aniq ko'rsatiladi; server tomonda ham `universal=true` → moslik yozuvlari o'chiriladi.)*
6. **Ko'rinish:** `Switch` «Katalogda ko'rsatish» (`is_active`), default yoqilgan.

**Jonli ko'rinish (o'ng ustun, 408px):** sarlavha «Mijoz shunday ko'radi» + `Segmented [Kartochka | Sahifa]`. **Kartochka:** haqiqiy `ProductCard` (yozayotganda real vaqtda: rasm, nom, narx, «Mos keladi» nishoni) 200px kenglikda; **Sahifa:** `ProductPage` ixcham nusxasi (galereya, narx, badge'lar). Bo'sh maydonlar — o'rin egallovchi «Mahsulot nomi» skeleton chizig'i.
**To'liqlik o'lchagichi** (preview ostida, `Card p-4`): halqa 48px + «Mahsulot sifati 67%» va 6 ta tekshiruv (checkbox-ko'rinishli, `check`/`circle` ikon + matn): ① kamida 1 rasm ② nom ≥ 8 belgi ③ kategoriya ④ tavsif ≥ 40 belgi ⑤ narx > 0 ⑥ moslik (universal yoki ≥1 model). Faqat maslahat — saqlashni bloklamaydi.

**Validatsiya va xatolar:** `blur`da va yuborishda; xatolar inline (13/18 danger + ikon); birinchi xatoli maydonga `focus` + `scrollIntoView({block:'center'})`; server `422 fields` → mos maydonga. Majburiy: nom, kategoriya, narx (**≥ 1 so'm**; `0` ruxsat etilmaydi), ombor ≥ 0. Rasmsiz saqlash mumkin, lekin tasdiq banneri «Rasmsiz mahsulot kam sotiladi» (bloklamaydi).
**Saqlash oqimi:** `Saqlash` → (yaratishda) `Saqlash va yana qo'shish` ikkilamchi tugma: forma tozalanadi, kategoriya/brend/o'rnatish saqlanadi (ketma-ket qo'shishni tezlashtiradi). Muvaffaqiyat: toast «"Sport diffuzor" katalogga qo'shildi» + birinchi mahsulotda **«check» chizilish animatsiyasi** (4.5-jadval); ro'yxatga qaytganda yangi qator tepada 240ms bilan paydo bo'ladi (highlight `accent/12` 1.2s so'nadi).
**Qoralama:** yaratish rejimida har 800ms `localStorage.carvision_product_draft` (rasm URL'lari bilan); qaytganda «Yakunlanmagan mahsulot topildi — Davom etish / O'chirish». **O'zgarish himoyasi:** chiqishda saqlanmagan o'zgarish bo'lsa `ConfirmDialog`; `beforeunload`.
**Klaviatura:** `Ctrl/Cmd+S` saqlaydi; Enter ko'p qatorli maydonda saqlamaydi.
**Tahrirlash rejimi qo'shimcha:** sarlavhada `Nusxa olish` va `O'chirish` (`more`); «Oxirgi o'zgarish: 14:32» 13/18.

### 5.6. Buyurtmalar — `/seller/orders`
- **Filtr chiplari** (`Chip h-11`, gorizontal, sonlari bilan): Hammasi · Yangi `3` · Qabul qilingan · O'rnatilmoqda · Tugagan · Bekor. Qidiruv: buyurtma raqami/mijoz ismi/telefon.
- **Desktop ≥1280: Kanban** 4 ustun (Yangi · Qabul qilingan · O'rnatilmoqda · Tugagan), ustun eni **`(1120−3·16)/4 = 268px`**, sarlavha `h-11` (nom + son), kartalar `gap-3`, ustun ichida skroll; «Bekor» — chip filtri orqali alohida ro'yxat. Statusni **kartadagi tugma** bilan o'zgartirish (sudrab o'tkazish — I). 768–1279 va mobil: bitta ustun ro'yxat.
- **Buyurtma kartasi** (`p-4`): yuqori qator `#a1b2c3d4` (14/20 600) + vaqt (13/18 muted), o'ngda `Badge` status; mijoz: **ism** (14/20) + **telefon** (`<a href="tel:+998…">` `min-h-11`, `phone` ikoni) + nusxa tugmasi; mahsulotlar: 40×40 rasm + «nom × 2» + summa (max 2 qator, «+3 yana»); pastda jami (`t-price`) va **keyingi status tugmasi** (`Button md`, primary; matn — «Qabul qilish» / «O'rnatishni boshlash» / «Tugallash»), ikkilamchi «Bekor qilish» (`danger`, `ConfirmDialog`: «Buyurtma bekor qilinadi va ombor qaytariladi»).
- **Tafsilot drawer** (`?order=<id>`): 480px; to'liq mahsulotlar, mijoz izohi (`note`), summa taqsimoti, **status tarixi (timeline)** — vertikal chiziq 2px + nuqtalar 12px (I: `order_events` jadvali; kesilsa — faqat joriy status).
- **Yangi buyurtma** kelganda: ro'yxat tepasiga 240ms bilan qo'shiladi, `accent` chegara 3s.
- Bo'sh: «Buyurtmalar yo'q. Mijozlar katalogdan buyurtma berganda shu yerda ko'rinadi.» + (demo uchun) ko'rsatma yo'q.
- Status o'zgarishi **optimistik emas** (server RPC tasdiqlaydi) — tugmada spinner, keyin karta yangi ustunga 200ms bilan o'tadi.

### 5.7. Kredit — `/seller/credits` (I bosqich; bugun minimal tuzatish)
Mavjud sahifa saqlanadi; **majburiy tuzatishlar:** atomik RPC (01-reja S2/S3), «mock to'lov» yozuvi faqat `PAYMENTS_MODE=mock`da; balans kartasi hero uslubida (32/36); paketlar 3 ustun (≥640), «Mashhur» paketida `Badge accent`. Qayta dizayn (grafik: kredit sarfi) — keyin.

### 5.8. Profil — `/seller/profile`
«Servis» (forma, `verified` badge) · «Akkaunt» (login nusxalash, parolni almashtirish, chiqish, «Parolni tiklash imkoni hozircha yo'q» ogohlantirishi) — 01-reja 5.4.

### 5.9. Holatlar jadvali (har ekran)
| Ekran | Yuklanish | Bo'sh | Xato |
| --- | --- | --- | --- |
| Panel | yakuniy layout'dagi skeleton (hero 240px, 4 tile 112px) | onboarding / nolli qiymatlar | `ErrorState` + «Qayta urinish» (karta ichida; qolganlari ishlayveradi) |
| Mahsulotlar | 6 qator skeleton (72px) | 1.3 / qidiruv bo'sh | `ErrorState` |
| Muharrir (tahrir) | forma skeleton | — | 404 → «Mahsulot topilmadi» + ro'yxatga havola |
| Buyurtmalar | 3 karta skeleton | matn | `ErrorState` |
| Tarmoq uzilishi | banner «Aloqa yo'q — o'zgarishlar saqlanmadi» (`role="alert"`) | | |

---

## 6. Backend (apps/api) va baza

### 6.1. Yangi migratsiya: `supabase/migrations/20260918_0002_seller_dashboard.sql`
```sql
-- Mahsulot galereyasi (products.image_url = birinchi rasm, karta/buyurtma snapshot uchun saqlanadi)
create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  position   smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (product_id, position) deferrable initially deferred
);
create index product_images_product_idx on product_images (product_id, position);
alter table product_images enable row level security;     -- siyosatsiz; publik o'qish view/API orqali
revoke all on product_images from anon, authenticated;

-- Universal moslik aniq bayroq
alter table products add column if not exists is_universal boolean not null default true;
update products p set is_universal = false
  where exists (select 1 from product_compatibility c where c.product_id = p.id);
alter table products add constraint products_price_pos check (price >= 1);   -- eski 0 narxlar bo'lsa avval tuzatiladi

-- Buyurtma tugallanish vaqti va hodisalar
alter table orders add column if not exists completed_at timestamptz;
update orders set completed_at = updated_at where status = 'completed' and completed_at is null;
create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on order_events (order_id, created_at);
alter table order_events enable row level security; revoke all on order_events from anon, authenticated;

-- Dashboard uchun indekslar
create index if not exists orders_seller_status_idx on orders (seller_id, status, created_at desc);
create index if not exists products_seller_active_idx on products (seller_id, is_active, created_at desc);
```
**RPC funksiyalar**
| Funksiya | Vazifa |
| --- | --- |
| `save_product(p_seller uuid, p_product uuid, p_fields jsonb, p_images text[], p_model_ids uuid[]) returns uuid` | **Bitta tranzaksiyada**: mahsulotni yaratadi/yangilaydi (egalik tekshiruvi), `product_images` ni to'liq almashtiradi (≤5, tartib = massiv indeksi), `image_url = p_images[1]`, moslikni almashtiradi (`is_universal` bo'lsa yozuvlar o'chadi). Qisman muvaffaqiyat (hozirgi holat: mahsulot bor, moslik yo'q) **yo'q bo'ladi**. |
| `seller_dashboard(p_seller uuid, p_days int) returns jsonb` | 6.2 |
| `set_order_status(...)` | 01-reja; qo'shimcha: `order_events` yozadi, `completed` da `completed_at = now()` |
| `duplicate_product(p_seller uuid, p_product uuid) returns uuid` | nom «… (nusxa)», `is_active=false`, rasm/moslik nusxalanadi |

### 6.2. `seller_dashboard` — hisob qoidalari
- Vaqt zonasi: **`Asia/Tashkent`** (UTC+5, DST yo'q): `(ts at time zone 'Asia/Tashkent')::date`.
- **Tushum** = `status='completed'` buyurtmalar summasi, **`completed_at`** sanasi bo'yicha. **Buyurtmalar soni** — `created_at` bo'yicha, `cancelled` chiqarilmaydi (alohida hisoblanadi).
- Diapazon `p_days ∈ {7,30,90}`: joriy `[bugun−(n−1), bugun]` va **oldingi teng davr** (delta uchun). `delta% = (joriy − oldingi) / oldingi`; oldingi 0 bo'lsa `null` («yangi» — UI `—`).
- **Qator to'ldirish:** `generate_series(from, to, '1 day')` LEFT JOIN — nol kunlar ham bor.
- Javob shakli:
```json
{
  "range": {"days": 30, "from": "2026-08-20", "to": "2026-09-18"},
  "kpi": {"revenue": 0, "revenue_prev": 0, "orders": 0, "orders_prev": 0,
          "avg_check": 0, "avg_check_prev": 0, "new_orders": 0, "pending_over_2h": 0,
          "active_products": 0, "low_stock": 0, "out_of_stock": 0, "no_image": 0, "credits": 0},
  "series": [{"d": "2026-08-20", "revenue": 0, "orders": 0}],
  "status_counts": {"new": 0, "accepted": 0, "installing": 0, "completed": 0, "cancelled": 0},
  "top_products": [{"id": "", "name": "", "image_url": null, "units": 0, "revenue": 0}]
}
```
`recent_orders` — alohida (`GET /api/seller/orders?limit=5`), chunki tuzilishi buyurtma ro'yxatiniki bilan bir xil.

### 6.3. API o'zgarishlari
| Endpoint | Izoh |
| --- | --- |
| `GET /api/seller/dashboard?days=30` | 6.2; `Cache-Control: private, max-age=15` |
| `GET /api/seller/counters` | `{new_orders, pending_over_2h, low_stock}` — engil (nav nishoni, 20s polling) |
| `GET /api/seller/products?search&category&status&sort&limit&offset` | `{products, total}`; server sahifalash |
| `POST /api/seller/products` · `PATCH /api/seller/products/:id` | body: `{name, description, category_id, brand, price, stock, installation_available, installation_price, is_universal, vehicle_model_ids, is_active, images: string[]}` → `save_product` RPC; `images` faqat **bizning Storage hostimiz** URL'lari (S12) |
| `PATCH /api/seller/products/:id/quick` | `{price?, stock?, is_active?}` (tezkor tahrir) |
| `POST /api/seller/products/:id/duplicate` | RPC |
| `POST /api/seller/products/images` | multipart, bitta fayl → `{url}`; magic-bytes (01-reja S10), ≤ 5 MB (klient siqadi), yo'l `products/{seller_id}/…`; **bitta seller ≤ 500 rasm/kun** (suiste'moldan himoya) |
| `GET /api/seller/orders?status&q&limit&offset` | javobga **`buyer: {name}`** (faqat seller endpointida; mijoz endpointida yo'q) va `items[].product_image_url` |
| `GET /api/seller/orders/:id` | tafsilot + `events` |
| `PATCH /api/seller/orders/:id` | `set_order_status` RPC |
| `GET /api/products`, `/api/products/:id`, `/api/categories` | **1.1** izolyatsiyasi; `categories` javobiga `product_count` |
| `POST /api/cart/items`, `/api/orders` | `requireRole('user')` |

`shared/types.ts`: `ProductImage`, `ProductWithRelations.images: ProductImage[]` va `is_universal`, `SellerDashboard`, `SellerCounters`, `OrderWithBuyer`, `Category.product_count?`.

### 6.4. Demo ma'lumot skriptlari
- `scripts/seed-demo-accounts.mjs` (01-reja): `demo_tuning`, `demo_parts` parollari.
- **`scripts/seed-demo-orders.mjs`** — `demo_buyer` foydalanuvchisi va **45 kunlik** realistik tarix: deterministik PRNG (`seed=2026`), kuniga 0–4 buyurtma (hafta oxiri ko'proq, o'sish trendi bilan → grafik jonli va delta musbat), holatlar: ko'pi `completed`, oxirgi 3 kunda `new`/`accepted`/`installing` aralash (dashboard «Yangi 3» va «E'tibor» to'ldiriladi), 2–3 ta `cancelled`; `completed_at`/`order_events` izchil. Ombor **kamaytirilmaydi** (tarix). `--clean` — `demo_buyer` va uning buyurtmalarini o'chiradi. `NODE_ENV=production` da `--i-know` bayrog'isiz ishlamaydi.
- **Rasmlar:** demoda **haqiqiy rasm yuklanishi ko'rsatiladi** — tayyor papka `demo-assets/` (foydalanuvchi 6–8 ta mahsulot foto'sini qo'yadi: disk, bamper, spoyler…). Seed mahsulotlar rasmsiz bo'lsa `ProductPlaceholder` (4.4) chiroyli turadi.

---

## 7. Frontend fayl rejasi (apps/web)

| Amal | Fayl |
| --- | --- |
| **Yangi** | `components/seller/SellerShell.tsx`, `SellerSidebar.tsx`, `SellerBottomNav.tsx` |
| **Yangi** | `pages/seller/SellerDashboard.tsx`, `SellerProducts.tsx`, `SellerProductEditor.tsx`, `SellerOrders.tsx`, `SellerProfile.tsx` |
| **Yangi** | `components/seller/dashboard/{HeroRevenue,StatTile,AttentionList,OrderStatusBars,TopProducts,RecentOrders,Onboarding}.tsx` |
| **Yangi** | `components/seller/products/{ProductTable,ProductRowCard,QuickEditCell,ProductToolbar,ShowcaseGrid}.tsx` |
| **Yangi** | `components/seller/editor/{GalleryUploader,CategoryGrid,CompatibilityPicker,LivePreview,QualityMeter,EditorSaveBar}.tsx` |
| **Yangi** | `components/seller/orders/{OrderCard,OrderKanban,OrderDrawer,StatusTimeline}.tsx` |
| **Yangi** | `components/charts/{AreaChart,BarList,Sparkline,ChartTooltip,EmptyChart}.tsx` |
| **Yangi** | `components/ui/{Switch,Stepper,MoneyInput,Toast,Drawer,ProductPlaceholder,DateRangeChips}.tsx` |
| **Yangi** | `hooks/{useCountUp,useReducedMotion,useDebounce,useDraft,useUnsavedGuard}.ts`, `lib/{chartMath,uzFormat,scope}.ts` |
| **Yangi** | `apps/web/vercel.json` (SPA fallback) |
| **O'zgaradi** | `App.tsx` (marshrutlar, `RequireRole`), `AppShell.tsx` (rolga qarab shell), `pages/{ResultPage,MarketplacePage,ProductPage}.tsx` (1.2), `components/ProductCard.tsx` (`ProductPlaceholder`, seller rejimi), `lib/api.ts`, `index.css` (tokenlar, `.cv-rise-sm`), `Icon.tsx` (4.3) |
| **O'chiriladi** | `pages/SellerPage.tsx`, `components/seller/{ProductFormModal,SellerProfileForm→SellerProfile ichiga}.tsx` |

**Kod-splitting:** `SellerDashboard`, `SellerProductEditor`, `SellerOrders` — `lazy()` (mijoz bundle'iga tushmaydi). Byudjet: Panel chunk ≤ 45 KB gzip, Muharrir ≤ 40 KB gzip, yangi kutubxona **yo'q** (grafik, drag-reorder, count-up — o'zimiz).
**Server holati:** React Query; `staleTime` 30s; mutatsiyalarda `invalidateQueries`; tezkor tahrir va Switch — optimistik (`onMutate`/`onError` rollback).
**Kirish nuqtasi (`SellerShell`) `Outlet` bilan:** `Suspense` fallback = tegishli skeleton.

---

## 8. Demo ssenariysi (5–7 daqiqa, «run of show»)

| # | Ko'rsatiladi | Nimani isbotlaydi |
| --- | --- | --- |
| 1 | `/auth` → «Ro'yxatdan o'tish» → **Avto-servis egasi** → servis maydonlari ochiladi → kirish | yangi auth va rol tanlash |
| 2 | Panel: hero tushum count-up, grafik chiziladi, 30 kunlik trend, «E'tibor talab qiladi» | jonli, ma'lumotga boy dashboard (demo seed) |
| 3 | **Yangi mahsulot:** 3 ta foto'ni bir vaqtda tashlash → progress → kategoriya panjarasi (Disklar) → narx (`3 200 000`) → moslik (Cobalt, Gentra) → o'ng tomonda **jonli kartochka** → `Ctrl+S` | asosiy talab: mukammal mahsulot qo'shish |
| 4 | Ro'yxatda yangi qator paydo bo'ladi; narxni **tezkor tahrir**; `Switch` bilan o'chirish/yoqish | tezlik va sifat |
| 5 | **Studio** → mashina → «Disklar» tanlash → Natija → «**Sizning mahsulotlaringiz**»: faqat yangi disk | **katalog izolyatsiyasi** |
| 6 | Boshqa kategoriya → bo'sh holat «Sizda mahsulot yo'q» → «Mahsulot qo'shish» | Studio→Panel ulanishi |
| 7 | Inkognito/boshqa brauzer: **oddiy foydalanuvchi** akkaunti → Studio natijasi/katalog — **hamma** do'konlar, jumladan yangi disk | ikki rolning farqi |
| 8 | Mijoz buyurtma beradi → seller panelida 20s ichida toast + nishon → «Qabul qilish» → status | real vaqt oqimi |

**Demo oldidan tekshiruv ro'yxati:** migratsiyalar qo'llangan; `seed-demo-accounts` + `seed-demo-orders` bajarilgan; `AI_PROVIDER` ma'lum (mock bo'lsa natija asl rasm — buni oldindan ayting yoki Gemini kalitini qo'ying); `demo-assets/` foto'lari tayyor; ikkita brauzer profili (seller / mijoz) oldindan ochilgan; internet zaxira varianti (ekran yozuvi).

---

## 9. Tekshirish

### 9.1. Avtomatik
```
npm run typecheck && npm run build
npm run db:migrate                       # ikki marta: ikkinchisida "0 ta yangi"
node scripts/smoke-auth.mjs              # 01-reja (20 holat)
node scripts/smoke-seller.mjs            # bu reja (quyida)
```
**`scripts/smoke-seller.mjs` — kutilgan natijalar**
| # | So'rov | Kutiladi |
| --- | --- | --- |
| 1 | Seller A mahsulot yaratadi (3 rasm, 2 model) | `200`, `images.length=3`, `image_url = images[0]` |
| 2 | Seller B ham mahsulot yaratadi | `200` |
| 3 | **Seller A** `GET /api/products` | **faqat A ning** mahsulotlari (B ning hech biri) |
| 4 | Seller A `GET /api/products?seller_id=<B>` | baribir faqat A (parametr e'tiborsiz) |
| 5 | Seller A `GET /api/products/<B mahsuloti>` | `404` |
| 6 | Seller A `GET /api/categories` | `product_count` faqat A bo'yicha |
| 7 | **User** `GET /api/products` | A **va** B mahsulotlari |
| 8 | Mehmon (tokensiz) `GET /api/products` | hamma faol (UI baribir `/auth`ga yo'naltiradi) |
| 9 | Seller `POST /api/cart/items` | `403 wrong_role` |
| 10 | Seller A `PATCH /api/seller/products/<B>` | `404` |
| 11 | 6 ta rasm bilan saqlash | `422` («5 tagacha rasm») |
| 12 | `images` da tashqi URL (`https://evil.example/x.jpg`) | `422` |
| 13 | Narx `0`, `-5`, `1e12`, `abc` | `422` (har biri) |
| 14 | `/api/seller/dashboard?days=30` | `series.length = 30` (nol kunlar bilan), `kpi.revenue` = tugallangan buyurtmalar yig'indisi |
| 15 | `days=45` | `422` (faqat 7/30/90) |
| 16 | Buyurtma `cancelled` → mahsulot `stock` | qaytadi |
| 17 | Seller A `GET /api/seller/orders/<B buyurtmasi>` | `404` |
| 18 | Mijoz `GET /api/orders` javobida | `buyer`/boshqa mijoz ma'lumoti **yo'q** |
| 19 | Yaroqsiz rasm (`.jpg` nomli PDF) yuklash | `415` |
| 20 | `save_product` o'rtasida xato (noto'g'ri `category_id`) | **hech narsa yozilmagan** (mahsulot ham, rasm ham) |

### 9.2. Qo'lda — piksel va sifat (DevTools, 320 / 390 / 768 / 1024 / 1280 / 1440 px)
- [ ] 1120px konteynerda: Panel yuqori qatori **736 + 24 + 360**; stat-tile'lar **268px**; pastki ikki karta **548px**; sidebar **240px**; kanban ustunlari **268px**; muharrir **680 + 32 + 408**.
- [ ] Barcha interaktiv elementlar ≥ 44×44 (Switch, Stepper, jadval ikonlari, galereya `×`, chiplar).
- [ ] Raqam ko'rsatkichlari: hero `48/52` proportional; jadval ustunlarida `tabular-nums`; NBSP ajratgich ko'chmaydi (satr bo'linmaydi).
- [ ] Gorizontal skroll **yo'q** (320px va 200% zoom'da ham).
- [ ] Skeleton → kontent o'tishida **layout sakramaydi** (Lighthouse CLS < 0.05).
- [ ] Grafik: chiziq 2px, end-dot 8px + 2px halqa, gridlar 1px tekis; hover tooltip chegaradan chiqmaydi (chetga yaqin nuqtada tomon almashtiradi); ←/→ ishlaydi; `Jadval` ko'rinishi to'g'ri; dark-only kontrast ≥ 3:1 (seriya), ≥ 4.5:1 (matnlar).
- [ ] Galereya: 5 ta rasmni bir vaqtda tashlash; 6-chisi rad; tartiblash (sichqoncha **va** klaviatura); yuklash xatosida qayta urinish; sahifani yangilash → qoralama tiklanadi.
- [ ] Animatsiyalar 60fps (Performance panel, dropped frames < 2%); `prefers-reduced-motion` yoqilganda count-up/chizilish/stagger yo'q.
- [ ] Modal/drawer: Esc, fokus tuzog'i, fokus qaytishi; ekran o'quvchi: jadval sarlavhalari, `aria-live` toast.
- [ ] Lighthouse mobil (Panel): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95; LCP < 2.5s (Fast 4G).
- [ ] Izolyatsiya (ikkita brauzer profili): seller Studio natijasida faqat o'zinikini, mijoz hammasini ko'radi; URL'ni qo'lda o'zgartirib ham (`/product/<boshqa>`) sellerga 404.

### 9.3. Qabul mezonlari (Definition of Done)
1. 9.1 hamma buyruqlar xatosiz; ikkala smoke skript to'liq o'tadi.
2. Servis egasi hech qaysi ekran/API orqali boshqa do'kon mahsulotini ko'ra olmaydi; oddiy foydalanuvchi hammasini ko'radi (Studio natijasi, katalog, kategoriyalar soni).
3. Mahsulot yaratish: ≤ 3 daqiqada 3 rasm bilan to'liq mahsulot (vaqt o'lchanadi); saqlash atomik.
4. 5.2–5.6 dagi o'lchamlar tasdiqlangan; 9.2 ro'yxati to'liq belgilangan.
5. Demo ssenariysi (8-bo'lim) **boshdan-oxirigacha xatosiz** ikki marta ketma-ket bajarilgan.

---

## 10. Xavflar va taxminlar

| Xavf | Yumshatish |
| --- | --- |
| 12–13 soatlik ish bugungi demoga sig'maydi | 2-bo'lim kesish tartibi; A, B, D-muharrir, G **hech qachon kesilmaydi** |
| Galereya + drag-reorder murakkab | Avval o'q tugmalari bilan tartiblash (kafolatli), sudrash — keyin qatlam sifatida |
| Vercel serverless yuklash limiti ~4.5 MB | Klient WebP siqish (odatda < 1 MB), server 5 MB cheklovi, aniq xato matni |
| AI `mock` rejimida Studio natijasi = asl rasm (o'zgarish ko'rinmaydi) | Demodan oldin `AI_PROVIDER=gemini` va kalit; yoki mock ekanini oldindan ayting |
| Yolg'on/ko'p demo ma'lumot haqiqiy ma'lumot bilan aralashib ketadi | `demo_buyer` orqali izolyatsiya + `seed-demo-orders --clean` |
| Rasm yuklab, saqlamasdan chiqilsa Storage'da yetim fayllar | Hozir qabul qilingan (kichik hajm); keyingi reja: `products/{seller}/` yetimlarni haftalik tozalash |
| `is_universal` migratsiyasi mavjud mahsulotlarga ta'sir | Migratsiya moslik yozuvi borlarni `false`, qolganini `true` qiladi (xulq o'zgarmaydi) |

**Taxminlar:** seller uchun narx ≥ 1 so'm; bitta mahsulot ≤ 5 rasm; tushum faqat `completed`; vaqt zonasi Toshkent; ilova qorong'i tema; buyurtma summasiga o'rnatish narxi hozircha qo'shilmaydi (01-reja S18).

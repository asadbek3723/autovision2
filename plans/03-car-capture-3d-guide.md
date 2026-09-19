# CarVision — Aqlli suratga olish (3D yo'lboshchi, mashinani aniqlash, kompas, avto-suratga olish) va mashinani to'liq o'zgartirib ko'rsatish

> Versiya 1.0 · 2026-09-18 · Til: o'zbek (lotin)
> Bog'liq: [01-auth-roles-seller-panel.md](01-auth-roles-seller-panel.md), [02-seller-dashboard.md](02-seller-dashboard.md). Bu reja **mijoz/servis egasi Studio oqimini** (suratga olish → aniqlash → o'zgartirish → natija) to'liq qamrab oladi.

---

## 0. Talab (foydalanuvchi so'zlari bilan) va qarorlar

| Talab | Qaror |
| --- | --- |
| Faqat **mashina** kadrga tushganda «tayyor» bo'lsin (odam, devor — yo'q) | Qurilmadagi obyekt detektori (`car`/`truck`); odam topilsa alohida xabar |
| Tepada kichik **3D mashina modeli** | `three.js` bilan past poligonli mashina, tepada shisha panelda |
| Qaysi tomondan olish kerak bo'lsa **model o'sha tomonga aylansin**, avval mashinani ko'rsatib | Har qadamda: umumiy ko'rinish → kerakli tomonga silliq burilish |
| Kerakli qism **qizil bo'lib yonib-o'chib tursin**; **to'g'ri pozada** turgandagina **yashil** | Shader bilan burchak zonasi qizil pulsatsiya → lock bo'lganda yashil |
| «Pastroq / tepaoroq / yaqinroq» deb **katta, animatsiyali** matn | Katta ko'rsatma banneri (26/30) + yo'nalish strelkasi animatsiyasi |
| **Kompas** orqali joylashuv | Telefon sensorlari (giroskop/kompas) → mashina atrofidagi burchak; har suratdan keyin qayta-mahkamlash |
| Mashina o'zi **avto-suratga** olsin | Barcha shartlar 700ms barqaror bajarilsa avtomatik; qo'lda tugma zaxira |
| Bugungi demo: **bitta mashinani to'liq o'zgartirib ko'rsatish** | 8 rakurs → aniqlash → konfiguratsiya → **barcha rakurslarda** generatsiya → **360° natija** |
| Juda professional, animatsiyali | 6-bo'lim: animatsiya jadvali, piksel spetsifikatsiya, haptika/tovush |

---

## 1. Hozirgi holat — nima ishlamayapti (skaner)

| # | Topilma | Joyi |
| --- | --- | --- |
| C1 | **Ramka «yashil» bo'lishi mashinaga bog'liq emas.** Shartlar: yorqinlik 40–235, Laplasian aniqligi ≥ 40, «qirralar ulushi» ≥ 4.5% va titramaslik. Odam, devor, stol — hammasi o'tadi. | `lib/frameCheck.ts:39-45,140-146` |
| C2 | **Burchakni tekshirish yo'q.** «O'ng tomon» deb turib old tomonni olsa ham qabul qilinadi; 8 ta kadr tartibi foydalanuvchining halolligiga bog'liq. | `CapturePage.tsx:241-271` |
| C3 | Tepada faqat matn; «kompas» diagrammasi faqat kirish ekranida, suratga olish paytida yo'q. | `CapturePage.tsx:435-458`, `AngleCompass.tsx` |
| C4 | Avto-suratga olish yo'q; tugma qo'lda. Landscape'da xavfsiz zonalar (`safe-area-inset-left/right`, notch) hisobga olinmagan. | `CapturePage.tsx:470-528` |
| C5 | **Mashina modeli/yili/rangi hech qayerda aniqlanmaydi va tanlanmaydi:** `createCar` doim `vehicle_model_id: null`; `useStudio.setVehicleModel` **hech qayerdan chaqirilmaydi**; `CarDetection`/`normalizeColor` (`shared/capture.ts`) yozilgan, lekin endpoint va UI yo'q. Natija: «Mening mashinamga mos» filtri hech qachon yoqilmaydi, Studio sarlavhasi bo'sh. | `CapturePage.tsx:74`, `useStudio.ts:41`, `shared/capture.ts:109-121` |
| C6 | **Tip nomuvofiqligi:** `Car` tipida `year`, `color`; bazada/API'da `detected_year`, `detected_color`. `StudioPage`da `car.year`/`car.color` doim `undefined`. | `shared/types.ts:16-28`, `schema.sql:158-171`, `StudioPage.tsx:153-156` |
| C7 | **Generatsiya faqat bitta kadr ustida.** 8 ta kadr olinadi, lekin AI bitta rasm beradi; qolgan 7 rakurs ishlatilmaydi. `INSTANT_GENERATION_ANGLES` e'lon qilingan, ammo hech qayerda ishlatilmagan. «Butun mashinani o'zgartirish» hozir mavjud emas. | `generations.ts:64-77`, `shared/capture.ts:16` |
| C8 | `AI_PROVIDER=mock` da natija = asl rasm (o'zgarish ko'rinmaydi). Demo uchun **haqiqiy provider shart**. | `ai/mock.ts` |
| C9 | Gemini chaqiruvi bitta rasm qabul qiladi; **rakurslar orasida izchillik** (bir xil disk/rang) kafolatlanmaydi. | `ai/gemini.ts:23-32` |
| C10 | iOS Safari'da `requestFullscreen` va `orientation.lock` yo'q; foydalanuvchi telefonni o'zi burishi kerak (portret ogohlantirishi bor, yaxshi). | `CapturePage.tsx:144-151` |

---

## 2. Bugungi demo uchun real baho va ustuvorlik

**Uchta reja jami katta** (01: auth ≈ 2.5 s + 02: seller ≈ 10 s + 03: quyidagi ≈ 19 s). Bir kunda hammasi sig'maydi — buni ochiq aytaman.

**«Bitta mashinani to'liq o'zgartirib ko'rsatish» demosi uchun minimal yo'l** (03-reja ichida):

| Bosqich | Mazmun | Vaqt | Demo uchun |
| --- | --- | --- | --- |
| **P1** | Mashina detektori + ko'rsatmalar + avto-suratga olish holat mashinasi (3D va kompassiz) | 3 s | **Shart** |
| **P2** | 3D yo'lboshchi (three.js, model, qizil pulsatsiya, aylanish) | 4 s | **Shart** (asosiy talab) |
| **P3** | Kompas/sensor orqali burchak + qayta-mahkamlash + qurilmada sozlash | 4.5 s | Shart (talab) — **eng xavfli** |
| **P4** | Mashinani aniqlash (Gemini vision) + tasdiqlash kartasi + `Car` tip tuzatish | 1.5 s | Shart (mos mahsulotlar va sarlavha uchun) |
| **P5** | Generatsiya to'plami (8 rakurs, izchillik) + 360° natija ko'rinishi | 3.5 s | **Shart** («to'liq o'zgartirib ko'rsatish») |
| **P6** | Sayqal: animatsiya, haptika/tovush, zaxira rejimlar (galereya/demo) | 2 s | Shart |
| **P7** | Haqiqiy mashina bilan sinov va repetitsiya | 1.5 s | **Shart** |

**Kesish tartibi** (vaqt yetmasa oxiridan): P3 ning ko'p bosqichli qayta-mahkamlashi → P5 da 8 o'rniga 3 rakurs (`INSTANT_GENERATION_ANGLES`) → P6 tovushlari → 3D dagi «yo'l bo'yicha nuqta» (zona pulsatsiyasi qoladi). **Hech qachon kesilmaydi:** P1 (mashinani aniqlash), P2 (3D + qizil/yashil), zaxira rejimlar (P6), P7.
**Maslahat:** bugun ko'rsatish uchun eng katta «wow» — **suratga olish + generatsiya + 360° natija** (03). Seller dashboard (02) va to'liq auth (01) bilan birga qilish uchun demo'ni ikki kunga bo'lish yoki 02 ni qisqartirish kerak — bu qarorni siz qabul qilasiz.

---

## 3. Foydalanuvchi oqimi (to'liq demo yo'li)

```
Studio ("Mashinani vizuallashtirish")
  └─ Kirish ekrani: 3D model aylanadi · [Boshlash]  ← ruxsatlar shu bosishda: kamera + sensor (iOS)
        └─ Tayyorgarlik (yuklash: detektor, 3D model)   progress halqa
              └─ Suratga olish · 8 qadam (har biri: ko'rsatish → izlash → lock → avto-surat → keyingi)
                    └─ "Mashina tayyor" (8/8)
                          └─ Aniqlash kartasi: "Chevrolet Cobalt · Oq"  [To'g'ri] [O'zgartirish]
                                └─ Konfigurator (mavjud): disk, spoyler, rang…
                                      └─ [Natijani ko'rish] → 8 rakursda generatsiya (3 tasi birinchi)
                                            └─ 360° natija: aylantirish + original/CarVision taqqoslash
                                                  └─ Mos mahsulotlar (01/02: rolga qarab)
```

---

## 4. Suratga olish holat mashinasi (har bir rakurs uchun)

```
INTRO ──► SEEKING ──► LOCKED ──► CAPTURED ──► (keyingi rakurs: INTRO)
            ▲   │        │
            │   └────────┘  (shart buzilsa LOCKED → SEEKING, 150ms histerezis)
            └── qayta olish (miniatura ustiga bosish)
```

| Holat | Davomiylik | 3D panel | Ko'rsatma bannerи | Reticle (ramka burchaklari) | Tugma |
| --- | --- | --- | --- | --- | --- |
| **INTRO** | 1.6s (1-qadamda 3.2s: to'liq 360° aylanish) | Kamera **umumiy ko'rinishga** uzoqlashadi → mashinani ko'rsatadi → kerakli tomonga burilib to'xtaydi | «Endi: **O'ng tomon**» (tushuntirish, `hint`) | qizil, xira | yo'q |
| **SEEKING** | ∞ | Kerakli zona **qizil pulsatsiya** (1.1 Hz); foydalanuvchi nuqtasi (kompas) halqada yuradi | Eng muhim muammo (7-bo'lim), strelka animatsiyasi | **qizil** (`#ff4d3d`), chiziqlar ingichka pulsatsiya | ko'rinmaydi (zaxira rejimda ko'rinadi) |
| **LOCKED** | 700ms | Zona **yashilga** o'tadi (250ms), 3D panel atrofida halqa 0→100% to'ladi | «Tayyor — ushlab turing» + `check` chiziladi | **yashil** (`#2e9e6b`), qalinlashadi | — |
| **CAPTURED** | 900ms | Segment `check` bilan to'ladi; kamera keyingi tomonga burilishni boshlaydi | «7/8 · Old tomon olindi» | flash | — |

**Cooldown:** suratdan keyin 1.2s davomida yangi lock bo'lmaydi (ikki marta olishning oldini oladi). **Qayta olish:** yuqori miniatura → «Qayta olish» → shu rakursga qaytadi (3D o'sha tomonga buriladi).
**«Yashil faqat to'g'ri pozada»** kafolati: LOCKED faqat 5 ta mezonning **hammasi** o'tganda (5.4-bo'lim).

---

## 5. Texnik arxitektura

### 5.1. Modullar
```
apps/web/src/capture/
  CaptureScreen.tsx          # sahifa: holat mashinasi, layout
  useCaptureSession.ts       # hook: kamera, detektor, sensor, mezonlar → holat
  detector.ts                # MediaPipe ObjectDetector (lazy), box tekislash (EMA)
  orientation.ts             # sensor → kamera quaternion → azimut/pitch; kalibrovka; qayta-mahkamlash
  geometry.ts                # sof funksiyalar: bearingError, fill, clip, aspect (testlanadi)
  guidance.ts                # sof funksiya: (measurements, target) → eng muhim ko'rsatma
  criteria.ts                # 5 mezon va toleranslar (angle bo'yicha)
  fx.ts                      # flash, vibrate, shutter tovushi (WebAudio)
components/capture/
  CarGuide.tsx               # tanlov: CarGuide3D | CarGuide2D (zaxira)
  CarGuide3D.tsx             # three.js sahna (lazy import)
  CarGuide2D.tsx             # tepadan ko'rinish SVG (zaxira, AngleCompass uslubi)
  GuidanceBanner.tsx         # katta ko'rsatma + strelka
  Reticle.tsx                # burchak-ramka (SVG)
  ShotTray.tsx               # miniaturalar + "uchib borish" animatsiyasi
  CriteriaPips.tsx           # 5 nuqta: Mashina · Burchak · Masofa · Balandlik · Barqaror
  DebugOverlay.tsx           # ?debug=1
public/mediapipe/            # wasm + model (self-host)
public/models/car-sedan.glb  # 3D model (CC0), LICENSE-models.txt
```
Eski `lib/frameCheck.ts` **saqlanadi** (yorqinlik/aniqlik/titrash uchun) va `criteria.ts` undan foydalanadi; «coverage» (qirralar ulushi) mashina mezonidan **chiqariladi**.

### 5.2. Mashinani aniqlash (P1)
- **Kutubxona:** `@mediapipe/tasks-vision` `ObjectDetector` (Apache-2.0), model **EfficientDet-Lite0** (COCO). Sinflar: `car`, `truck` (SUV/pikap ba'zan `truck` deyiladi); `person` — alohida.
- **Self-host:** wasm va `.tflite` `apps/web/public/mediapipe/` da (CDN'ga bog'liq emas — demo joyida internet beqaror bo'lishi mumkin). Yuklash **kirish ekranida** boshlanadi (progress halqasi), suratga olish boshlanganda tayyor. Hajm ≈ 10–15 MB birinchi marta, keyin brauzer keshi (`Cache-Control: immutable`).
- **Ishlash:** `detectForVideo(video, timestamp)` har **100–150ms** (7–10 fps), kirish rasmi 320px; GPU delegate, xato bo'lsa CPU/WASM. Box **EMA** (α=0.5) bilan tekislanadi; ishonch ≥ **0.45** (yaqin/qisman kadrlarda pastroq balli bo'lishi mumkin; sinovda sozlanadi).
- **Natija:** `{box:{x,y,w,h}, score, kind:'car'|'person'|'none'}` normalizatsiya qilingan (0–1, video koordinatalari).
- **Yaqin kadrlar (g'ildirak, salon — ixtiyoriy):** detektor **o'chiriladi**, faqat aniqlik/titrash tekshiriladi.
- **Zaxira:** WebGL/WASM ishlamasa yoki model yuklanmasa → «Demo rejim» (6.7): mashina mezoni o'tkazib yuboriladi va qo'lda tugma.

### 5.3. Sensor orqali joylashuv (P3) — «kompas»
**G'oya:** mashina atrofida aylanganda foydalanuvchi telefonni doim mashinaga qaratadi, ya'ni **kamera yo'nalishi = mashinaning foydalanuvchiga nisbatan yo'nalishi**. Kamera azimuti o'zgarishi = foydalanuvchining mashina atrofidagi burchak o'zgarishi.

```
sensor:  DeviceOrientationEvent (alpha, beta, gamma) + screen.orientation.angle
         iOS: webkitCompassHeading (mutlaq) · Android: 'deviceorientationabsolute'
q      = quaternion(alpha,beta,gamma) × ekran burilishi × (-90° X)     // three.js DeviceOrientationControls formulasi
fwd    = q · (0,0,-1)                                                   // kamera oldinga vektori
ψ_cam  = atan2(fwd.x, fwd.z)  (gorizontal azimut)      θ = asin(fwd.y)  (pitch)
ψ_car  = ψ_cam + (cx − 0.5) · hFOV                                      // mashina markazi kadr markazida bo'lmasa tuzatish; hFOV ≈ 63° (taxmin)
bearing = normalize( bearing_ref + s · (ψ_car − ψ_ref) )                // s = ±1 (qurilmada tekshiriladi)
```
- **Mahkamlash (anchoring):** **har suratdan keyin** `ψ_ref ← ψ_car`, `bearing_ref ← rakursning nominal burchagi` (old=0°, old-chap=45°…). Shu bilan magnetometr xatosi va drift faqat **45° qadam** ichida to'planadi (jami 360° emas). Birinchi kadr — old tomon (0°) — kalibrovka nuqtasi: «Mashina oldida turing» qadami shu uchun.
- **Ishonchlilik:** magnit buzilishi (mashina metalli yaqin) → nisbiy giroskop (alpha) mutlaq kompasdan ustun; mutlaq kompas faqat `ψ_ref` ni boshlang'ich tanlash uchun. `bearing` ishonch bahosi (`sensorConfidence`) burchak o'zgarish tezligi va sensor aniqligidan (`webkitCompassAccuracy`) hisoblanadi; past bo'lsa burchak mezoni **yumshoq** bo'ladi: faqat maslahat beradi, lockni bloklamaydi (5.4-jadvalning oxirgi ustuni).
- **Ruxsat:** iOS 13+ da `DeviceOrientationEvent.requestPermission()` **faqat foydalanuvchi bosishi ichida** → «Boshlash» tugmasi (kamera ruxsati bilan birga). Faqat **HTTPS** (Vercel/tunnel). Rad etilsa yoki sensor yo'q → kompassiz rejim (5.4-jadval oxirgi ustun).
- **Yo'nalish:** aylanish tartibi mavjud `CAPTURE_ANGLES` bilan bir xil (0°→45°→90°… old → old-chap → chap yon…; tepadan qaraganda soat miliga **teskari**, ya'ni mashinaning **chap** tomoniga qarab). `s` belgisini qurilmada bir marta tekshirib qo'yamiz (`?debug=1` overlay ψ va bearing ni ko'rsatadi).
- **Xavf (halol):** bu qism faqat **real telefonda** sozlanadi; kodni yozib, sinovsiz ishonchli deb bo'lmaydi. P3 da 1.5 s faqat qurilma sinoviga ajratilgan (7.2).

### 5.4. Mezonlar (LOCK sharti) — har rakurs uchun
| # | Mezon | O'lchov | Qabul (LOCK) | Ogohlantirish | Kompassiz/zaxira |
| --- | --- | --- | --- | --- | --- |
| 1 | **Mashina** | detektor: `car/truck`, ishonch, box ramka ichida | ishonch ≥ 0.45, box guide-rect ichida (chetlardan ≥ 2% bo'sh) | odam → «Bu odam…»; yo'q → «Mashinaga qarating» | **majburiy** (faqat Demo rejimda o'chadi) |
| 2 | **Burchak** | `|bearing − nominal|` | **≤ 15°** | 15–35° «yaqin», > 35° «aylaning» | box nisbati (aspect) bilan **yumshoq**: bo'lmasa o'tkazadi, faqat maslahat |
| 3 | **Masofa** | box kengligi / guide-rect kengligi (`fill`) | rakursga qarab pastdagi jadval | «Yaqinroq» / «Uzoqroq» | majburiy |
| 4 | **Balandlik/markaz** | box markazi vertikal og'ishi; tepa/past qirqilishi; sensor `pitch` | markaz ±8% (vertikal), ±10% (gorizontal); pitch ±8° | «Kamerani yuqoriga/pastga buring», «O'rtaga oling» | markaz majburiy, pitch ixtiyoriy |
| 5 | **Barqaror** | motion ≤ 12, aniqlik ≥ 40, yorqinlik 40–235 (mavjud `THRESHOLDS`) | 700ms uzluksiz | «Qimirlatmang», «Yorug'lik yetarli emas» | majburiy |

**Rakurs bo'yicha `fill` (box eni / guide-rect eni) va nisbat (eni/bo'yi) polosalari** (boshlang'ich qiymatlar — sinovda sozlanadi; `criteria.ts` da bir joyda):
| Rakurs | Nominal burchak | `fill` | Nisbat (yumshoq sanity) |
| --- | --- | --- | --- |
| Old / Orqa | 0° / 180° | 0.50–0.75 | 1.1–1.9 |
| 3/4 (4 ta) | 45°, 135°, 225°, 315° | 0.62–0.88 | 1.7–2.6 |
| Yon (chap/o'ng) | 90° / 270° | 0.72–0.94 | 2.3–3.6 |

Chegaradan chiqish (mashina qirqilgan): tepa kesilsa → «Uzoqroq turing» yoki «Kamerani yuqoriga buring»; pastki (g'ildirak) kesilsa → «Kamerani pastga buring»; yon kesilsa → «Uzoqroq turing».
**Kalit prinsip:** yashil = 5 mezonning **hammasi**. Har bir mezon histerezis bilan (o'tish 3 ketma-ket kadr, chiqish 2 kadr — mavjud `OK_STREAK/BAD_STREAK` mantig'i).

---

## 6. 3D yo'lboshchi va animatsiya

### 6.1. Sahna (three.js, vanilla; `React.lazy` bilan alohida chunk)
- **Kutubxona:** faqat `three` (tree-shaken, `GLTFLoader`; Draco'siz). `@react-three/fiber` **ishlatilmaydi** (qo'shimcha og'irlik, React bilan render sikli bahsi). Komponent `useEffect` ichida renderer'ni boshqaradi va unmount'da hammasini `dispose()` qiladi.
- **Model:** CC0 past poligonli sedan (Quaternius «Cars» yoki Kenney «Car Kit» — yuklashda litsenziya tasdiqlanadi, `public/models/LICENSE-models.txt`). ≤ 400 KB (`gltf-transform optimize` bilan siqiladi, teksturasiz). Model o'z materiallaridan **voz kechiladi**: bitta uslubiy material — to'q grafit korpus (`MeshStandardMaterial`, roughness .45, metalness .6), qora g'ildirak, qorong'i shisha; **fresnel rim-yorug'lik** (`onBeforeCompile`) — premium «hologram/clay» ko'rinish.
- **Zaxira model:** GLB yuklanmasa yoki WebGL yo'q → `CarGuide2D` (tepadan SVG, xuddi shu props).
- **Yoritish:** 1 yo'nalishli + 1 hemisfera yorug'lik, soyalar yo'q; yer — nozik radial gradient disk va **8 segmentli halqa** (radius 1.6 × mashina uzunligi/2).
- **Qizil zona (model-agnostik):** korpus materialiga `onBeforeCompile` bilan uniform'lar: `uTargetBearing`, `uHalf` (±30° asosiy zona, yumshoq chegara ±10°), `uPulse`, `uMix` (qizil↔yashil). Fragment mahalliy pozitsiyasidan **azimut** `atan2(pos.x, pos.z)` hisoblanadi; burchak masofasi bo'yicha `smoothstep` → emissive rang. Mashina qismlarini nomlash shart emas.
- **Rang:** SEEKING — `#ff4d3d` emissive; LOCKED — `#2e9e6b` (mavjud `--color-success`). Pulsatsiya: `0.15 ↔ 1.0`, sinus, **1.1 Hz** (3 Hz dan past — yorug'lik-sezgir foydalanuvchilar uchun xavfsiz). `prefers-reduced-motion`: pulsatsiyasiz, o'zgarmas qizil.
- **Yer halqasi:** 8 segment; **olingan** segment — yashil `check` belgi; **joriy** — qizil pulsatsiya; **kutilayotgan** — ingichka kulrang. **Foydalanuvchi nuqtasi:** halqada kamera-konus ikonkasi (`bearing` bo'yicha, 120ms silliqlash), mashinaga qarab turadi.
- **Kamera harakati:** orbita, balandlik 18°, radius r. `INTRO`: 0–400ms r×1.35 gacha uzoqlashadi (mashina to'liq ko'rinadi) → 400–1400ms **kerakli tomonga** aylanadi (`cubic-bezier(.65,0,.35,1)`, eng qisqa yo'l bo'yicha) → 1400ms dan zona pulsatsiyasi. 1-qadamda intro'da to'liq 360° (2.4s) va keyin old tomonga qaytish.
- **«O'ng tomon» qoidasi:** model **kerakli tomonni kameraga qaratadi** (o'ng tomon = mashinaning o'ng yoni ko'rinadi). Tepada yorlig'i («O'ng tomon») panel ostida.

### 6.2. Panel (piksel)
- Joyi: **yuqori-chapda**, `left: max(16px, env(safe-area-inset-left))`, `top: max(12px, env(safe-area-inset-top))`.
- O'lcham: `width: clamp(168px, 26vw, 224px)`, `aspect-ratio: 3/2` (844×390 da **224×149**; 667×375 da 173×115). `border-radius 20px`, `bg rgba(11,12,14,.55)`, `border 1px rgba(255,255,255,.12)`, `backdrop-filter: blur(8px)` (faqat qo'llab-quvvatlansa; aks holda `bg .78`), ichki `padding 0`. Canvas DPR ≤ 2, **30 fps** cheklov.
- Holat halqasi: panel konturi 2px — SEEKING qizil pulsatsiya (`box-shadow 0 0 0 0 → 8px alpha 0`, 900ms), LOCKED yashil to'ladi (`conic-gradient` 0→360°, 700ms).
- Yorliq (panel ostida, `mt-2`): «**O'ng tomon**» 15/20 600 + `6/8` 13/18 muted; matn **soyali** (`text-shadow 0 1px 6px rgba(0,0,0,.6)`) — kamera fonida o'qiladi.

### 6.3. Ko'rsatma banneri (katta, animatsiyali)
- Panelning **o'ng tomonida** (`left = panel.right + 16px`), vertikal panel tepasi bilan tekislangan; eni `min(420px, 100vw − panel − 2·16 − o'ng tugmalar)`.
- **Yuqori qator:** «Endi: O'ng tomon» 13/18 `white/60`.
- **Asosiy matn:** **26/30**, 650, `-0.02em`, oq; chapda **strelka/ikon plitka** 44×44 (`rounded-xl`, `bg white/12`), ikonlar: `chevron-up/down/left/right`, `zoom-in/out` (yaqinroq/uzoqroq), `rotate` (aylaning), `target` (o'rtaga), `check`.
- **Animatsiya:** matn almashganda crossfade + `translateY(6px→0)` 180ms; strelka **sakrab turadi** (`translate ±6px`, 700ms `ease-in-out`, cheksiz) — yo'nalishi mos; lock'da matn yashil, `check` 300ms chiziladi.
- **Barqarorlik:** ko'rsatma **kamida 600ms** turadi (miltillashning oldini olish); yangisiga faqat prioritet oshsa yoki 600ms o'tsa almashadi.
- **Fon:** matn ostida yumshoq gradient (`linear-gradient(90deg, rgba(0,0,0,.55), transparent)`) — kontrast ≥ 4.5:1 har qanday kamera fonida; kerak bo'lsa `text-shadow`.
- `aria-live="polite"` — ekran o'quvchi ko'rsatmani o'qiydi (faqat matn o'zgarganda).

### 6.4. Reticle (ramka)
Hozirgi to'liq to'rtburchak + qora sirt o'rniga: **4 ta burchak** (`L` shakl, yelka **28px**, chiziq **3px**, `border-radius 12px`), guide-rect `FRAME_RECT` (x .08, y .12, w .84, h .76) bo'yicha; tashqi qoraytirish `rgba(0,0,0,.35)` (mavjud .45 dan yengil). SEEKING — qizil, burchaklar **nafas oladi** (`scale 1↔1.02`, 1.1s); LOCKED — yashil, yelkalar 28→36px uzayadi (200ms), ichkarida kichik `check`.

### 6.5. Animatsiya jadvali
| Element | Davomiylik / easing | Tafsilot |
| --- | --- | --- |
| Kirish ekrani 3D | uzluksiz | mashina sekin aylanadi (`14s/360°`), zonalar bir-bir yonadi (mavjud `cv-node` ohangi) |
| INTRO kamera | 400 + 1000ms `(.65,0,.35,1)` | 6.1 |
| Zona pulsatsiyasi | 900ms sinus, cheksiz | qizil, reduced-motion'da statik |
| Qizil→yashil | 250ms | `uMix` 0→1 (`ease-out`) |
| Lock halqasi | 700ms chiziqli | `conic-gradient` |
| Suratga olish flash | 220ms | oq qatlam `opacity 0→.85→0` |
| Shutter «diafragma» | 160ms | reticle burchaklari markazga `scale .96` va qaytadi |
| Miniatura uchishi | 350ms `(.16,1,.3,1)` | kadr markazdan pastki lentaga uchadi (`transform`), lentada `scale .8→1` |
| 3D segment check | 300ms | segment yashil to'ladi + halqada `scale 1→1.15→1` |
| Keyingi rakursga o'tish | 900ms | 6.1 INTRO |
| Ko'rsatma matni | 180ms | 6.3 |
| Strelka | 700ms cheksiz | 6.3 |
| 8/8 tugash | 1.2s | halqa to'liq yashil, mashina sekin aylanadi, «Mashina tayyor» + `cv-rise`; konfeti **yo'q** (professional) |
Hamma animatsiya faqat `transform`/`opacity`; `prefers-reduced-motion` — pulsatsiya/sakrash/aylanish yo'q (faqat ≤120ms fade).

### 6.6. Haptika va tovush
- **Vibratsiya** (`navigator.vibrate`, faqat Android; iOS'da yo'q — jimgina o'tkaziladi): LOCK `12ms`, suratga olish `[18,40,18]`, xato `[40]`.
- **Tovush** (WebAudio, tashqi fayl yo'q): shutter — 25ms filtrlangan shovqin + 60ms past ohang; LOCK — yumshoq 880 Hz «tik» (40ms). Default **yoqilgan**, ustida `volume` ikonkasi bilan o'chiriladi (`localStorage`). Birinchi bosishdan keyin `AudioContext.resume()`.

### 6.7. Zaxira rejimlar (demo tirikligi uchun)
| Rejim | Qachon | Xulq |
| --- | --- | --- |
| **Kompassiz** | sensor yo'q/rad etilgan | Burchak mezoni yumshoq; 3D «foydalanuvchi nuqtasi»siz; qo'lda tugma ham bor |
| **Detektorsiz (Demo)** | model yuklanmadi yoki `?demo=1` / yashirin tugma (logo 5 marta bosish) | Mashina mezoni o'chadi; lock faqat barqarorlik bo'yicha; qo'lda tugma |
| **Galereyadan** | har rakursda «Galereya» tugmasi (`<input type=file accept=image/*>`) | Tayyor rasm yuklanadi (`resizeImage`), tekshiruvsiz (yoki detektor bilan ogohlantirish) |
| **2D yo'lboshchi** | WebGL/GLB yo'q | `CarGuide2D` |
Bu zaxiralar kutilmagan holatda demoni qutqaradi; **kesilmaydi**.

### 6.8. Layout (landscape; portret ogohlantirishi mavjud)
```
┌────────────────────────────────────────────────────────────────────┐  844×390
│ ┌────────────┐  Endi: O'ng tomon · 6/8                    [×] [O'tk.]│
│ │  3D  🚗    │  ⟵  Kamerani biroz pastga buring                     │
│ │  224×149   │                                                       │
│ └────────────┘   ┌ ┐                              ┌ ┐               │
│  O'ng tomon 6/8  └                 (kamera)         ┘               │
│                       [ ● Mashina ● Burchak ○ Masofa ○ Balan ○ Barq ]│
│  [▣][▣][▣][▣][▣][▣]        Olindi 6/8         (   ◉   )  [Yakunlash] │
└────────────────────────────────────────────────────────────────────┘
```
Chetlar `max(16px, env(safe-area-inset-*))`; **mezon nuqtalari** (5 ta, `10px` doira + 12/16 yorliq; o'tgan — yashil `check`, o'tmagan — kulrang/qizil) reticle ostida markazda; pastki lenta balandligi `72px`, miniatura `64×44`; qo'lda tugma `72×72` (faqat zaxira rejimlarda to'liq ko'rinadi, aks holda `56×56` kichik «qo'lda» ikonka). Barcha tugmalar ≥ 44×44.

---

## 7. Ko'rsatmalar (guidance) — prioritet va matnlar
Sof funksiya `resolveGuidance(m, target)`; **yuqoridan pastga birinchi mos kelgani** ko'rsatiladi (avval eng oson tuzatiladigan/eng blokirovchi):

| # | Shart | Matn (uz) | Ikon |
| --- | --- | --- | --- |
| 1 | portret | «Telefonni yon holatga buring» | `rotate` |
| 2 | yorqinlik past/yuqori | «Yorug'lik yetarli emas» / «Kadr juda yorug'» | `sun` |
| 3 | odam topildi, mashina yo'q | «Bu odam — kamerani mashinaga qarating» | `car` |
| 4 | mashina yo'q | «Mashinaga qarating» | `car` |
| 5 | burchak xatosi > 35° | «Mashina atrofida aylaning — **{Tomon}**ga o'ting» | `rotate` |
| 6 | burchak 15–35° | «Yana biroz aylaning — **{Tomon}**» | `rotate` (yo'nalishli) |
| 7 | `fill` past | «Yaqinroq keling» | `zoom-in` |
| 8 | `fill` yuqori yoki qirqilgan | «Uzoqroq turing» | `zoom-out` |
| 9 | markaz balandda | «Kamerani biroz yuqoriga buring» | `chevron-up` |
| 10 | markaz pastda | «Kamerani biroz pastga buring» | `chevron-down` |
| 11 | markaz chapda/o'ngda | «Kamerani chapga/o'ngga buring» | `chevron-left/right` |
| 12 | pitch > ±8° | «Telefonni to'g'ri ushlang» | `sliders` |
| 13 | titrash | «Qimirlatmay ushlang» | `hand` |
| 14 | xira | «Fokusni kuting» | `focus` |
| 15 | hammasi joyida | «Tayyor — ushlab turing» | `check` |

`{Tomon}` — mashinaga nisbatan aniq: «old», «orqa», «chap yon», «o'ng yon», «old-chap burchak»… (chap/o'ng chalkashligini bartaraf etish uchun **mashina** nuqtai nazaridan). Rakurs bo'yicha maxsus `hint` (mavjud `CAPTURE_ANGLES[].hint`) faqat INTRO'da.
«Kamerani yuqoriga buring» — ob'ekt kadrda **balandda** turganda: kamerani yuqoriga qaratsa mashina pastga tushadi. Bu qoida qurilmada tekshiriladi (7.2).

---

## 8. Mashinani aniqlash va to'liq o'zgartirish (P4, P5)

### 8.1. Aniqlash (P4)
- `POST /api/cars/:id/identify` — old(-chap) kadrni Gemini **vision** modeliga yuboradi (`GEMINI_VISION_MODEL`, `.env`); javob JSON (sxema bilan): `{brand, model, year_range, color, confidence}`. `vehicle_models` bilan **normalizatsiyalangan** moslash (kichik harf, bo'shliq/defis olib tashlash: `Nexia 3`≈`nexia3`); topilsa `vehicle_model_id`, aks holda matn saqlanadi. `normalizeColor` (mavjud) rangni `CAR_COLORS` ga tushiradi.
- **UI: `IdentifyCard`** — suratga olishdan keyin: rasm + «**Chevrolet Cobalt · Oq**», `confidence < DETECTION_CONFIRM_THRESHOLD (0.6)` bo'lsa taxmin emas, **tanlov** so'raladi (brend → model → yil → rang chiplari). Tasdiqlansa `PATCH /api/cars/:id` + `useStudio.setVehicleModel` (C5 tuzatiladi) → «Mening mashinamga mos» ishga tushadi.
- **Zaxira:** AI ishlamasa/kalit yo'q — qo'lda tanlov (shu kartaning ikkinchi qismi), demoni to'xtatmaydi.
- **C6 tuzatish:** `toCar()` mapper — `detected_year → year`, `detected_color → color`, `detected_brand/model` saqlanadi; `Car` tipi va `StudioPage` mos.

### 8.2. Generatsiya to'plami — «butun mashinani o'zgartirish» (P5)
**Muammo:** hozir 1 tanlov = 1 rasm (C7). **Yechim:** bitta konfiguratsiya = **to'plam (set)** — barcha (yoki tanlangan) rakurslar uchun.

- **Baza:** `generation_sets(id, user_id, car_id, options jsonb, free_text, prompt, anchor_generation_id, created_at)`; `generations` ga `set_id uuid`, `angle text`, `reference_generation_id uuid`. Indeks `(set_id)`.
- **Tartib (izchillik uchun):** 1) **anchor** — `front-left` (3/4, eng informativ) alohida chaqiruv; 2) qolgan rakurslar **anchor'ni ikkinchi rasm sifatida** (reference) oladi: prompt — «*Birinchi rasm tahrir qilinadigan foto. Ikkinchi rasm — xuddi shu mashinaning boshqa rakursdan **allaqachon o'zgartirilgan** varianti: xuddi shu diskni, rangni, detallarni aynan takrorla*»; 3) `INSTANT_GENERATION_ANGLES = ['front-left','left','rear-right']` birinchi (mavjud, ishlatilmagan konstanta shu yerda ishga tushadi), qolgan 5 tasi keyin; parallel **2 tadan**.
- **Server 60s (Vercel `maxDuration`)** chegarasi uchun **har rakurs alohida so'rov** (`POST /api/generations` ga `set_id`, `angle`, `reference_generation_id` qo'shiladi); **orkestratsiya klientda** (parallellik 2, xatoda 1 marta avto-qayta urinish). Kesilgan/xato rakurs — 360° ko'rinishda «Qayta urinish» plitkasi.
- **`ImageEditProvider`** ga `referenceImage?: {image, mimeType}` qo'shiladi; `gemini.ts` `parts` ga ikkinchi `inlineData`; `openai.ts` da ko'p-rasmli edit; `mock` — original.
- **Limit:** `DAILY_GENERATION_LIMIT` (20 rasm) → **`3 to'plam/kun/foydalanuvchi`** + 30 rasm/kun (qattiq tepa). Servis egasi uchun ham. (01-reja S7 bilan birga.)
- **Xarajat/kechikish:** to'plam = 8 pullik chaqiruv; har biri ~10–30s (provayderga bog'liq), parallel 2 → ≈ 1–2 daqiqa. **Narx provayder tarifiga bog'liq — demodan oldin tekshiring** (o'zimizning API kalitimizga sarflanadi). UI: progress «3/8 tayyor», birinchi 3 rakurs chiqishi bilan natija ochiladi (kutdirmaydi).
- **`AI_PROVIDER=gemini`** va kalit — demo shartlari (C8).

### 8.3. 360° natija ko'rinishi (`Result360`)
- `ResultPage` **qayta quriladi**: tepada **viewer**, ostida rakurs lentasi, keyin mos mahsulotlar (01/02 izolyatsiyasi bilan).
- **Viewer:** 8 rakurs bearing bo'yicha tartiblangan; **gorizontal sudrash** (pointer) rakurslar orasida siljiydi — qo'shni ikki rasm orasida **crossfade** (`opacity`, 120–200ms, 45° chegarasida), momentum yo'q (aniq snap). O'ng-pastda `Segmented [CarVision | Original]` — bosib turib original bilan taqqoslash (mavjud `CompareSlider` mantig'i qayta ishlatiladi). Tepa-chapda «Old-chap 3/4 · 2/8» yorlig'i.
- **Kirish animatsiyasi:** 8 rakurs ketma-ket avtomatik aylanadi (1.6s, faqat birinchi ko'rsatilganda) — «360°» hissi.
- **Lenta:** 8 miniatura (`72×48`, `rounded-md`), holat: tayyor / jarayonda (shimmer) / xato (`alert` + qayta urinish). Faol — accent chegara + `check`.
- **Holatlar:** hech bo'lmasa anchor tayyor bo'lmaguncha — skeleton (`aspect-[16/10]`); qisman — tayyorlari ishlaydi, qolganlari «Tayyorlanmoqda…».
- **Progress:** yuqorida ingichka (4px) bar `n/8`, tugagach 300ms fade-out.

---

## 9. Backend/DB o'zgarishlari (xulosa)
Yangi migratsiya `supabase/migrations/20260918_0003_capture_sets.sql`:
- `generation_sets`, `generations.set_id/angle/reference_generation_id`, indekslar; `cars.detect_confidence` mavjud (`detection_confidence`) ishlatiladi.
- RLS: siyosatsiz + `revoke` (01-reja uslubi).
API: `POST /api/cars/:id/identify`, `PATCH /api/cars/:id`, `POST /api/generation-sets`, `POST /api/generations` (kengaytirilgan), `GET /api/generation-sets/:id` (natijalar + holatlar). Hammasi `requireRole('user','seller')` (02-reja 1.4).
Env: `GEMINI_VISION_MODEL`, `GEMINI_API_KEY` (mavjud), `SET_LIMIT_PER_DAY=3`.

---

## 10. Tekshirish

### 10.1. Avtomatik
```
npm run typecheck && npm run build
npm run test -w @carvision/web          # sof funksiyalar (Vitest)
node scripts/smoke-sets.mjs             # to'plam oqimi (mock provider)
```
**Vitest (web):** `geometry.ts` (bearing xatosi 350°↔10° aylanma, `fill`, qirqilish), `guidance.ts` (jadval bo'yicha: har shart → kutilgan matn; prioritet; 600ms barqarorlik), `criteria.ts` (histerezis 3/2), `orientation.ts` (sintetik quaternionlar: 0°/45°/90° aylanish → kutilgan `ψ`, ekran burilishi 0/90 bilan).
**Smoke (API):** to'plam yaratish → anchor → reference bilan qolganlari; 4-to'plam `429`; boshqa foydalanuvchi to'plamiga kirish `404`.

### 10.2. Real qurilma va real mashina (majburiy; kod yozib qo'ydim ≠ ishlaydi)
1. **Sensor kalibrovkasi (30 daq):** mashina atrofida 45° belgilarga (yerga lenta) turib `?debug=1` da `bearing` xatosini yozib olish; maqsad: **|xato| ≤ 12°** (qayta-mahkamlash bilan). `s` belgisi va `hFOV` tuzatiladi. Kamida **bitta iPhone (Safari) va bitta Android (Chrome)** da.
2. **Detektor:** old/orqa/3-4/yon, soyada, quyoshda, kechqurun; odam, devor, boshqa mashina; **yolg'on «yashil» = 0** (odam va bo'sh devor bilan 2 daqiqa sinov).
3. **Tuzatish yo'nalishi:** «Kamerani yuqoriga/pastga/chapga/o'ngga» matnlari haqiqatan to'g'ri tomonga olib boradimi (qo'lda 10 marta).
4. **Ishlash:** 30 daqiqa uzluksiz — telefon qizishi, kadr tezligi (≥ 24 fps kamera, detektor ≥ 6 fps, 3D 30 fps), batareya.
5. **To'liq oqim:** 8 rakurs → aniqlash → 2 konfiguratsiya → 360° natija — **boshdan-oxirigacha 3 marta** xatosiz.

### 10.3. Qo'lda (piksel/UX)
- [ ] 3D panel 844×390 da **224×149**, 667×375 da 173×115; notch'da chetlar `safe-area` bilan.
- [ ] Qizil pulsatsiya 1.1 Hz; LOCK'da 250ms ichida yashil; reduced-motion'da pulsatsiya yo'q.
- [ ] Ko'rsatma matni kamera fonida (oq devor, quyosh) o'qiladi (kontrast ≥ 4.5:1); 600ms ichida almashmaydi.
- [ ] Avto-surat: LOCK 700ms → flash → miniatura uchadi → 3D keyingi tomonga buriladi; cooldown 1.2s.
- [ ] Zaxira rejimlar: kompassiz, detektorsiz (demo), galereya, 2D yo'lboshchi — har biri alohida sinaldi.
- [ ] 360° viewer: sudrash silliq, crossfade 200ms, taqqoslash ishlaydi.

### 10.4. Qabul mezonlari
1. Odam yoki bo'sh devor kadrda bo'lganda **hech qachon yashil/avto-surat yo'q**.
2. Har rakursda model **kerakli tomonga aylanadi**, qizil yonadi, **faqat to'g'ri pozada yashil**; noto'g'ri tomondan (masalan, old o'rniga orqa) LOCK bo'lmaydi (kompas ishlaganda).
3. Real mashinada 8 rakurs ≤ 3 daqiqada olinadi (tugmasiz).
4. Bitta konfiguratsiya **8 rakursda** (yoki kamida 3 ta instant) izchil ko'rinadi va 360° viewerda aylantiriladi.
5. Demo ssenariysi boshdan-oxirigacha xatosiz uch marta ketma-ket.

---

## 11. Xavflar va taxminlar
| Xavf | Yumshatish |
| --- | --- |
| **Kompas aniqligi** (metall, telefon modeli, iOS/Android farqi) | Har suratdan keyin qayta-mahkamlash; ishonch past bo'lsa burchak mezoni yumshoq; kompassiz zaxira; qurilmada sozlash 1.5–2 s |
| iOS Safari: `requestFullscreen`/orientation lock yo'q | Foydalanuvchi o'zi buradi (portret ogohlantirishi bor); «Add to Home Screen» (standalone) tavsiyasi |
| Model yuklash 10–15 MB, demo joyida sekin Wi-Fi | Self-host, kirish ekranida oldindan yuklash + progress; demo oldidan **bir marta ochib kesh isitish** |
| Detektor kichik/qisman mashinani o'tkazib yuboradi | Ishonch 0.45; `car`+`truck`; yaqin kadrlarda o'chirish; sinovda sozlash; detektorsiz zaxira |
| 3D + ML + kamera qizitadi | 30/8 fps cheklov, kichik canvas, `low-power`, sahna tashqarida render to'xtaydi |
| Gemini 8 rakursda izchil bo'lmasligi, kechikish, kvota/narx | Anchor+reference; 3 instant rakurs birinchi; per-rakurs qayta urinish; kunlik limit; demoda 3 rakurs bilan ham to'liq ko'rsatish mumkin |
| 3D model litsenziyasi | Faqat CC0; `LICENSE-models.txt`; zaxira — protsedural/2D |
| Vaqt: 01+02+03 bir kunga sig'maydi | 2-bo'lim kesish tartibi; prioritet qarorini foydalanuvchi qabul qiladi |

**Taxminlar:** bitta umumiy sedan 3D modeli (rangi keyin aniqlangan rangga bo'yalishi mumkin — keyingi qadam); aylanish yo'nalishi mavjud `CAPTURE_ANGLES` tartibida; mashina odatda ochiq joyda 2–5 m atrofida aylanib o'tiladi; demo real mashina bilan, internet mavjud; `AI_PROVIDER=gemini`.

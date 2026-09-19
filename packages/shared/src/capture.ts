/**
 * Avtomobilni rasmga olish oqimi.
 *
 * 8 ta majburiy rakurs 45° qadam bilan avtomobil atrofini to'liq yopadi —
 * bu 2D vizualizatsiya uchun yetarli minimal to'plam. 30° qadam (12 kadr)
 * fotogrammetriya qilinmayotgani uchun sezilarli foyda bermaydi.
 *
 * Qo'shimcha 2 ta yaqin kadr marketplace kategoriyalarini to'g'ri chiqarishga
 * yordam beradi.
 */

export const REQUIRED_CAR_PHOTOS = 8;
export const MAX_CAR_PHOTOS = 10;

/** Kutish xonasida darhol generatsiya qilinadigan rakurslar soni */
export const INSTANT_GENERATION_ANGLES = ['front-left', 'left', 'rear-right'] as const;

export interface CaptureAngle {
  id: string;
  label: string;
  /** Foydalanuvchiga qayerda turishni tushuntiruvchi qisqa matn */
  hint: string;
  /**
   * Avtomobil atrofidagi pozitsiya, gradusda. 0° — avtomobil oldida,
   * 90° — chap yon, 180° — orqa. Tepadan ko'rinish diagrammasi shu
   * qiymat asosida kamera nuqtasini joylashtiradi.
   */
  bearing: number;
  /** Kadrda avtomobil egallashi kerak bo'lgan maydon ulushi (0–1) */
  targetFill: number;
  required: boolean;
}

export const CAPTURE_ANGLES: CaptureAngle[] = [
  { id: 'front',       label: 'Old tomon',       hint: 'Avtomobil oldida, kapotga ro‘para turing', bearing: 0,   targetFill: 0.55, required: true },
  { id: 'front-left',  label: 'Old chap 3/4',    hint: 'Old chap burchakka o‘ting',                bearing: 45,  targetFill: 0.60, required: true },
  { id: 'left',        label: 'Chap yon',        hint: 'Chap yonga o‘ting, butun uzunligi sig‘sin', bearing: 90,  targetFill: 0.65, required: true },
  { id: 'rear-left',   label: 'Orqa chap 3/4',   hint: 'Orqa chap burchakka o‘ting',               bearing: 135, targetFill: 0.60, required: true },
  { id: 'rear',        label: 'Orqa tomon',      hint: 'Avtomobil orqasida, bagajga ro‘para',      bearing: 180, targetFill: 0.55, required: true },
  { id: 'rear-right',  label: 'Orqa o‘ng 3/4',   hint: 'Orqa o‘ng burchakka o‘ting',               bearing: 225, targetFill: 0.60, required: true },
  { id: 'right',       label: 'O‘ng yon',        hint: 'O‘ng yonga o‘ting, butun uzunligi sig‘sin', bearing: 270, targetFill: 0.65, required: true },
  { id: 'front-right', label: 'Old o‘ng 3/4',    hint: 'Old o‘ng burchakka o‘ting',                bearing: 315, targetFill: 0.60, required: true },
  { id: 'wheel',       label: 'G‘ildirak',       hint: 'Bitta g‘ildirakka yaqinlashing',           bearing: 90,  targetFill: 0.45, required: false },
  { id: 'interior',    label: 'Salon',           hint: 'Eshikni ochib, salonni oling',             bearing: 90,  targetFill: 0.50, required: false },
];

export const REQUIRED_ANGLES = CAPTURE_ANGLES.filter((a) => a.required);

export function angleLabel(id: string): string {
  return CAPTURE_ANGLES.find((a) => a.id === id)?.label ?? id;
}

export function findAngle(id: string): CaptureAngle | undefined {
  return CAPTURE_ANGLES.find((a) => a.id === id);
}

/* --------------------------------------------------------------- Ranglar */

export interface CarColor {
  value: string;
  label: string;
  swatch: string;
}

export const CAR_COLORS: CarColor[] = [
  { value: 'white',  label: 'Oq',        swatch: '#EDEFF2' },
  { value: 'black',  label: 'Qora',      swatch: '#17181A' },
  { value: 'silver', label: 'Kumush',    swatch: '#C9CCD1' },
  { value: 'grey',   label: 'Kulrang',   swatch: '#6F7378' },
  { value: 'blue',   label: 'Ko‘k',      swatch: '#1E3A8A' },
  { value: 'red',    label: 'Qizil',     swatch: '#B3261E' },
  { value: 'green',  label: 'Yashil',    swatch: '#1F4D3A' },
  { value: 'brown',  label: 'Jigarrang', swatch: '#5B4231' },
  { value: 'beige',  label: 'Bej',       swatch: '#C9B89A' },
  { value: 'yellow', label: 'Sariq',     swatch: '#C79A0E' },
];

export function colorLabel(value: string | null | undefined): string | null {
  return CAR_COLORS.find((c) => c.value === value)?.label ?? null;
}

/** AI qaytargan erkin rang nomini bizdagi ro'yxatga moslashtiradi */
export function normalizeColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.toLowerCase().trim();
  const direct = CAR_COLORS.find((c) => c.value === text || c.label.toLowerCase() === text);
  if (direct) return direct.value;

  const aliases: Record<string, string> = {
    oq: 'white', white: 'white', pearl: 'white',
    qora: 'black', black: 'black',
    kumush: 'silver', silver: 'silver',
    kulrang: 'grey', grey: 'grey', gray: 'grey', nardo: 'grey',
    'ko‘k': 'blue', kok: 'blue', blue: 'blue', navy: 'blue',
    qizil: 'red', red: 'red', burgundy: 'red',
    yashil: 'green', green: 'green',
    jigarrang: 'brown', brown: 'brown', bronze: 'brown',
    bej: 'beige', beige: 'beige', gold: 'beige',
    sariq: 'yellow', yellow: 'yellow', orange: 'yellow',
  };
  for (const [key, value] of Object.entries(aliases)) {
    if (text.includes(key)) return value;
  }
  return null;
}

/* ------------------------------------------------ AI aniqlash natijasi */

export interface CarDetection {
  brand: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  /** 0–1; past bo'lsa foydalanuvchidan so'raymiz, taxmin qilmaymiz */
  confidence: number;
  /** Bazadagi mos model topilgan bo'lsa */
  vehicle_model_id: string | null;
}

/** Shu qiymatdan past bo'lsa foydalanuvchidan tasdiq emas, tanlov so'raymiz */
export const DETECTION_CONFIRM_THRESHOLD = 0.6;

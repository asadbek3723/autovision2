/**
 * Customization katalogi — AI prompt va marketplace filter uchun yagona manba.
 *
 * Bo'limlar avtomobil qismlari bo'yicha taqsimlangan: foydalanuvchi tuning
 * atamasini emas, mashinasining qaysi qismini o'zgartirayotganini tanlaydi.
 * Studio konfiguratori shu ro'yxatni pastki dokda render qiladi.
 */

export const CATEGORY_SLUGS = [
  'front-bumper',
  'rear-bumper',
  'fenders',
  'windows',
  'wheels',
  'tires',
  'spoilers',
  'headlights',
  'taillights',
  'grille',
  'paint',
  'interior',
  'detailing',
  'accessories',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  'front-bumper': 'Oldi bamper',
  'rear-bumper': 'Orqa bamper',
  fenders: 'Yon qanotlar',
  windows: 'Oynalar',
  wheels: 'Disklar',
  tires: 'Shinalar',
  spoilers: 'Spoyler',
  headlights: 'Faralar',
  taillights: 'Orqa chiroqlar',
  grille: 'Oldi panjara',
  paint: 'Rang / wrap',
  interior: 'Salon',
  detailing: 'Detailing',
  accessories: 'Aksessuarlar',
};

export interface CustomizationOption {
  /** Option id — generations.options ichida saqlanadi */
  value: string;
  label: string;
  /** AI promptga qo'shiladigan ingliz tilidagi bo'lak */
  prompt: string;
  /** Rangli variantlar uchun swatch */
  swatch?: string;
}

export interface CustomizationGroup {
  /** generations.options kaliti */
  key: string;
  label: string;
  /** Qaysi marketplace kategoriyasiga olib boradi */
  category: CategorySlug;
  /** Bitta konfiguratsiyada guruhdan faqat bitta qiymat tanlanadi */
  options: CustomizationOption[];
}

export const CUSTOMIZATION_GROUPS: CustomizationGroup[] = [
  {
    key: 'front_bumper',
    label: 'Oldi bamper',
    category: 'front-bumper',
    options: [
      { value: 'lip', label: 'Lip splitter', prompt: 'a front bumper lip splitter' },
      {
        value: 'sport',
        label: 'Sport bamper',
        prompt: 'an aggressive sport front bumper with larger air intakes',
      },
      {
        value: 'carbon-lip',
        label: 'Karbon lip',
        prompt: 'a carbon fiber front lip splitter',
      },
      {
        value: 'wide',
        label: 'Widebody',
        prompt: 'a widebody front bumper with wide integrated fender extensions',
      },
    ],
  },
  {
    key: 'rear_bumper',
    label: 'Orqa bamper',
    category: 'rear-bumper',
    options: [
      { value: 'diffuser', label: 'Diffuzor', prompt: 'a rear diffuser under the rear bumper' },
      {
        value: 'sport',
        label: 'Sport bamper',
        prompt: 'a sport rear bumper with an integrated diffuser',
      },
      {
        value: 'carbon-diffuser',
        label: 'Karbon diffuzor',
        prompt: 'a carbon fiber rear diffuser',
      },
    ],
  },
  {
    key: 'fenders',
    label: 'Yon qanotlar',
    category: 'fenders',
    options: [
      { value: 'skirts', label: 'Yon skirt', prompt: 'side skirt extensions along the sills' },
      {
        value: 'flares',
        label: 'Kengaytirilgan',
        prompt: 'widebody fender flares over the wheel arches',
      },
    ],
  },
  {
    key: 'windows',
    label: 'Oynalar',
    category: 'windows',
    options: [
      {
        value: 'tint-35',
        label: 'Tonirovka 35%',
        prompt: 'light 35% window tint on the side and rear windows',
        swatch: '#5A6068',
      },
      {
        value: 'tint-20',
        label: 'Tonirovka 20%',
        prompt: 'medium 20% window tint on the side and rear windows',
        swatch: '#33373D',
      },
      {
        value: 'tint-5',
        label: 'Tonirovka 5%',
        prompt: 'dark 5% limo window tint on the side and rear windows',
        swatch: '#15171A',
      },
    ],
  },
  {
    key: 'wheels',
    label: 'Disklar',
    category: 'wheels',
    options: [
      {
        value: 'sport-black',
        label: 'Sport / qora',
        prompt: 'multi-spoke matte black sport alloy wheels',
        swatch: '#1B1B1D',
      },
      {
        value: 'sport-silver',
        label: 'Sport / kumush',
        prompt: 'multi-spoke silver sport alloy wheels',
        swatch: '#C9CCD1',
      },
      {
        value: 'bronze',
        label: 'Bronza',
        prompt: 'bronze finish forged alloy wheels',
        swatch: '#8C6239',
      },
      {
        value: 'deep-dish',
        label: 'Deep dish',
        prompt: 'deep dish concave alloy wheels with a polished lip',
        swatch: '#6E7378',
      },
      {
        value: 'oem-plus',
        label: 'OEM+',
        prompt: 'clean OEM-style upgraded alloy wheels',
        swatch: '#9AA0A6',
      },
    ],
  },
  {
    key: 'tires',
    label: 'Shinalar',
    category: 'tires',
    options: [
      { value: 'low-profile', label: 'Past profil', prompt: 'low profile tires' },
      { value: 'stretched', label: 'Stretch', prompt: 'stretched sidewall low profile tires' },
      { value: 'all-terrain', label: 'All-terrain', prompt: 'chunky all-terrain tires' },
    ],
  },
  {
    key: 'spoiler',
    label: 'Spoyler',
    category: 'spoilers',
    options: [
      { value: 'lip', label: 'Lip', prompt: 'a subtle trunk lip spoiler matching the body' },
      { value: 'ducktail', label: 'Ducktail', prompt: 'a ducktail rear spoiler' },
      { value: 'gt-wing', label: 'GT wing', prompt: 'a motorsport GT wing rear spoiler' },
      { value: 'carbon-lip', label: 'Karbon lip', prompt: 'a carbon fiber trunk lip spoiler' },
    ],
  },
  {
    key: 'headlights',
    label: 'Faralar',
    category: 'headlights',
    options: [
      {
        value: 'led-white',
        label: 'LED oq',
        prompt: 'crisp white LED headlights with a modern daytime running light signature',
        swatch: '#E8EEF7',
      },
      {
        value: 'smoked',
        label: 'Smoked',
        prompt: 'smoked dark tinted headlight housings',
        swatch: '#26292E',
      },
      {
        value: 'angel-eyes',
        label: 'Angel eyes',
        prompt: 'angel eye ring headlights',
        swatch: '#9DC2FF',
      },
    ],
  },
  {
    key: 'taillights',
    label: 'Orqa chiroqlar',
    category: 'taillights',
    options: [
      {
        value: 'smoked',
        label: 'Smoked',
        prompt: 'smoked dark tinted taillight housings',
        swatch: '#2A1F22',
      },
      {
        value: 'led-bar',
        label: 'LED bar',
        prompt: 'full-width LED light bar taillights',
        swatch: '#B3261E',
      },
      {
        value: 'clear',
        label: 'Shaffof',
        prompt: 'clear lens taillights',
        swatch: '#C2C6CC',
      },
    ],
  },
  {
    key: 'paint',
    label: 'Rang',
    category: 'paint',
    options: [
      {
        value: 'gloss-white',
        label: 'Oq',
        prompt: 'glossy pearl white (#F2F4F7)',
        swatch: '#F2F4F7',
      },
      {
        value: 'gloss-black',
        label: 'Qora',
        prompt: 'glossy jet black (#0D0E10)',
        swatch: '#0D0E10',
      },
      {
        value: 'silver',
        label: 'Kumush',
        prompt: 'metallic silver (#B9BEC5)',
        swatch: '#B9BEC5',
      },
      {
        value: 'matte-grey',
        label: 'Kulrang (matte)',
        prompt: 'matte nardo grey (#6F7378)',
        swatch: '#6F7378',
      },
      {
        value: 'satin-black',
        label: 'Satin qora',
        prompt: 'satin black (#17181A)',
        swatch: '#17181A',
      },
      {
        value: 'racing-red',
        label: 'Qizil',
        prompt: 'glossy racing red (#C1121F)',
        swatch: '#C1121F',
      },
      {
        value: 'deep-blue',
        label: "To'q ko'k",
        prompt: 'deep metallic blue (#1E3A8A)',
        swatch: '#1E3A8A',
      },
      {
        value: 'sky-blue',
        label: "Ko'k",
        prompt: 'bright metallic blue (#2F6BFF)',
        swatch: '#2F6BFF',
      },
      {
        value: 'forest-green',
        label: 'Yashil',
        prompt: 'metallic british racing green (#1F4D3A)',
        swatch: '#1F4D3A',
      },
      {
        value: 'yellow',
        label: 'Sariq',
        prompt: 'glossy sunflower yellow (#F2B705)',
        swatch: '#F2B705',
      },
      {
        value: 'orange',
        label: "To'q sariq",
        prompt: 'glossy vivid orange (#F26A1B)',
        swatch: '#F26A1B',
      },
      {
        value: 'purple',
        label: 'Binafsha',
        prompt: 'deep metallic purple (#5B2A86)',
        swatch: '#5B2A86',
      },
    ],
  },
  {
    key: 'interior',
    label: 'Salon',
    category: 'interior',
    options: [
      {
        value: 'alcantara',
        label: 'Alcantara',
        prompt: 'an alcantara trimmed interior',
        swatch: '#2E3238',
      },
      {
        value: 'red-stitch',
        label: 'Qizil tikuv',
        prompt: 'black interior with red contrast stitching',
        swatch: '#8E2B22',
      },
      {
        value: 'carbon-trim',
        label: 'Karbon panel',
        prompt: 'carbon fiber interior trim panels',
        swatch: '#1B1D20',
      },
    ],
  },
];

export const ORDER_STATUS_LABELS = {
  new: 'Yangi',
  accepted: 'Qabul qilindi',
  installing: "O'rnatilmoqda",
  completed: 'Yakunlandi',
  cancelled: 'Bekor qilindi',
} as const;

/** Statusning keyingi ruxsat etilgan qiymatlari (seller dashboard uchun) */
export const ORDER_STATUS_FLOW = {
  new: ['accepted', 'cancelled'],
  accepted: ['installing', 'cancelled'],
  installing: ['completed'],
  completed: [],
  cancelled: [],
} as const;

export function findGroup(key: string): CustomizationGroup | undefined {
  return CUSTOMIZATION_GROUPS.find((g) => g.key === key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Katalog mahsulotini tanlash: option qiymati mahsulot id'si (UUID), kaliti esa
 * mahsulot kategoriyasi (masalan headlights → <product uuid>).
 * Statik variantlar (rang va h.k.) esa oddiy matn qiymati bilan saqlanadi.
 */
export function isProductOption(value: string | undefined | null): value is string {
  return Boolean(value && UUID_RE.test(value));
}

/** generations.options ichidan tanlangan mahsulot id'lari */
export function productIdsFromOptions(options: Record<string, string>): string[] {
  return Object.values(options).filter(isProductOption);
}

/** Tanlangan option'lardan marketplace kategoriya slug'larini chiqaradi */
export function categoriesFromOptions(options: Record<string, string>): CategorySlug[] {
  const slugs = new Set<CategorySlug>();
  for (const [key, value] of Object.entries(options)) {
    if (!value) continue;
    if (isProductOption(value)) {
      if ((CATEGORY_SLUGS as readonly string[]).includes(key)) slugs.add(key as CategorySlug);
      continue;
    }
    const group = findGroup(key);
    if (group) slugs.add(group.category);
  }
  return [...slugs];
}

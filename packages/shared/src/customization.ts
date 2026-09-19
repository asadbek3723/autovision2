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
    label: 'Rang / wrap',
    category: 'paint',
    options: [
      {
        value: 'satin-black',
        label: 'Satin qora',
        prompt: 'a satin black vinyl wrap',
        swatch: '#17181A',
      },
      {
        value: 'matte-grey',
        label: 'Matte kulrang',
        prompt: 'a matte nardo grey vinyl wrap',
        swatch: '#6F7378',
      },
      {
        value: 'gloss-white',
        label: 'Gloss oq',
        prompt: 'a gloss pearl white vinyl wrap',
        swatch: '#EDEFF2',
      },
      {
        value: 'deep-blue',
        label: "To'q ko'k",
        prompt: 'a deep metallic blue paint finish',
        swatch: '#1E3A8A',
      },
      {
        value: 'racing-red',
        label: 'Racing qizil',
        prompt: 'a gloss racing red paint finish',
        swatch: '#B3261E',
      },
      {
        value: 'forest-green',
        label: 'Yashil',
        prompt: 'a metallic british racing green paint finish',
        swatch: '#1F4D3A',
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

/** Tanlangan option'lardan marketplace kategoriya slug'larini chiqaradi */
export function categoriesFromOptions(options: Record<string, string>): CategorySlug[] {
  const slugs = new Set<CategorySlug>();
  for (const key of Object.keys(options)) {
    const group = findGroup(key);
    if (group && options[key]) slugs.add(group.category);
  }
  return [...slugs];
}

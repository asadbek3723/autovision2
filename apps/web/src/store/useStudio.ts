import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Car, Generation } from '@carvision/shared';

/**
 * AI customization sessiyasi — upload → configure → generate → marketplace
 * oqimi bo'ylab tanlovni saqlaydi (reja 12-bo'limi: konfiguratsiyadan
 * marketplace'ga o'tish uzluksiz bo'lishi kerak).
 */
interface StudioState {
  /**
   * Saqlangan mashina qaysi foydalanuvchiga tegishli. Mehmon sessiyasi yangilansa
   * (token eskirsa) foydalanuvchi o'zgaradi va eski car_id boshqa odamniki bo'lib
   * qoladi — server u uchun 404 "Avtomobil topilmadi" qaytaradi.
   */
  ownerId: string | null;
  car: Car | null;
  /** Konfiguratsiya qaysi kadr ustida ishlashi */
  photoUrl: string | null;
  vehicleModelId: string | null;
  options: Record<string, string>;
  freeText: string;
  /** Oxirgi generatsiya */
  generation: Generation | null;
  /**
   * Joriy tanlov bo'yicha natijalar: asl kadr URL → generatsiya. Har bir kadr uchun
   * before/after ko'rsatish uchun; tanlov o'zgarsa tozalanadi.
   */
  results: Record<string, Generation>;

  /** Sessiya egasi o'zgargan bo'lsa saqlangan mashina va natijalarni tozalaydi */
  ensureOwner: (userId: string | null) => void;
  setCar: (car: Car | null) => void;
  setPhotoUrl: (url: string | null) => void;
  setVehicleModel: (id: string | null) => void;
  toggleOption: (key: string, value: string) => void;
  setFreeText: (text: string) => void;
  setGeneration: (generation: Generation | null) => void;
  resetConfiguration: () => void;
  reset: () => void;
}

export const useStudio = create<StudioState>()(
  persist(
    (set) => ({
      ownerId: null,
      car: null,
      photoUrl: null,
      vehicleModelId: null,
      options: {},
      freeText: '',
      generation: null,
      results: {},

      ensureOwner: (userId) =>
        set((state) => {
          if (!userId || state.ownerId === userId) return { ownerId: userId ?? state.ownerId };
          // Boshqa foydalanuvchi: eski mashina/natijalar bu sessiyada ishlamaydi
          return {
            ownerId: userId,
            car: null,
            photoUrl: null,
            options: {},
            freeText: '',
            generation: null,
            results: {},
          };
        }),

      setCar: (car) => set({ car, photoUrl: car?.image_url ?? null, generation: null, results: {} }),
      setPhotoUrl: (photoUrl) => set({ photoUrl }),
      setVehicleModel: (vehicleModelId) => set({ vehicleModelId }),

      /** Bir guruhdan faqat bitta qiymat; qayta bosilsa bekor qilinadi */
      toggleOption: (key, value) =>
        set((state) => {
          const next = { ...state.options };
          if (next[key] === value) delete next[key];
          else next[key] = value;
          // Tanlov o'zgargan — avvalgi natijalar endi mos emas
          return { options: next, generation: null, results: {} };
        }),

      setFreeText: (freeText) => set({ freeText, generation: null, results: {} }),
      setGeneration: (generation) =>
        set((state) => ({
          generation,
          results: generation
            ? { ...state.results, [generation.original_image]: generation }
            : state.results,
        })),
      resetConfiguration: () => set({ options: {}, freeText: '', generation: null, results: {} }),
      reset: () =>
        set({
          car: null,
          photoUrl: null,
          options: {},
          freeText: '',
          generation: null,
          results: {},
          vehicleModelId: null,
        }),
    }),
    {
      name: 'carvision-studio',
      // v2: tanlovlar endi katalog mahsulot id'lari — eski (matnli) tanlovlar mos emas
      version: 2,
      migrate: (persisted) => ({
        ...(persisted as Record<string, unknown>),
        options: {},
        generation: null,
        results: {},
      }) as unknown as StudioState,
      partialize: (state) => ({
        ownerId: state.ownerId,
        car: state.car,
        photoUrl: state.photoUrl,
        vehicleModelId: state.vehicleModelId,
        options: state.options,
        freeText: state.freeText,
        generation: state.generation?.id.startsWith('local-') ? null : state.generation,
        results: Object.fromEntries(
          Object.entries(state.results).filter(([, g]) => !g.id.startsWith('local-'))
        ),
      }),
    }
  )
);

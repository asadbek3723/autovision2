import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Car, Generation } from '@carvision/shared';

/**
 * AI customization sessiyasi — upload → configure → generate → marketplace
 * oqimi bo'ylab tanlovni saqlaydi (reja 12-bo'limi: konfiguratsiyadan
 * marketplace'ga o'tish uzluksiz bo'lishi kerak).
 */
interface StudioState {
  car: Car | null;
  /** Konfiguratsiya qaysi kadr ustida ishlashi */
  photoUrl: string | null;
  vehicleModelId: string | null;
  options: Record<string, string>;
  freeText: string;
  generation: Generation | null;

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
      car: null,
      photoUrl: null,
      vehicleModelId: null,
      options: {},
      freeText: '',
      generation: null,

      setCar: (car) => set({ car, photoUrl: car?.image_url ?? null, generation: null }),
      setPhotoUrl: (photoUrl) => set({ photoUrl, generation: null }),
      setVehicleModel: (vehicleModelId) => set({ vehicleModelId }),

      /** Bir guruhdan faqat bitta qiymat; qayta bosilsa bekor qilinadi */
      toggleOption: (key, value) =>
        set((state) => {
          const next = { ...state.options };
          if (next[key] === value) delete next[key];
          else next[key] = value;
          return { options: next };
        }),

      setFreeText: (freeText) => set({ freeText }),
      setGeneration: (generation) => set({ generation }),
      resetConfiguration: () => set({ options: {}, freeText: '', generation: null }),
      reset: () =>
        set({
          car: null,
          photoUrl: null,
          options: {},
          freeText: '',
          generation: null,
          vehicleModelId: null,
        }),
    }),
    {
      name: 'carvision-studio',
      partialize: (state) => ({
        car: state.car,
        photoUrl: state.photoUrl,
        vehicleModelId: state.vehicleModelId,
        options: state.options,
        freeText: state.freeText,
        generation: state.generation,
      }),
    }
  )
);

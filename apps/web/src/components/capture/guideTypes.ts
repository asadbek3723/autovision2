/**
 * 3D/2D yo'lboshchi va suratga olish sessiyasi o'rtasidagi umumiy holat.
 * Yo'lboshchi uni har kadrda `ref` orqali o'qiydi — React qayta chizilishisiz.
 */

export type GuidePhase = 'intro' | 'seeking' | 'locked' | 'captured' | 'done';

export interface GuideState {
  /** Nishon tomon: 0 old, 90 chap yon, 180 orqa, 270 o'ng yon */
  target: number;
  phase: GuidePhase;
  /** Foydalanuvchining taxminiy burchagi (kompas); null — sensor yo'q */
  user: number | null;
  /** Olingan rakurslarning nominal burchaklari */
  captured: number[];
  /** 0–1: LOCK to'lib borishi */
  lockProgress: number;
  /** Har yangi qadamda oshadi — yo'lboshchi INTRO animatsiyasini boshlaydi */
  stepKey: number;
  /** Birinchi qadam: to'liq 360° aylanish bilan boshlanadi */
  firstStep: boolean;
  reducedMotion: boolean;
}

export const INITIAL_GUIDE_STATE: GuideState = {
  target: 0,
  phase: 'intro',
  user: null,
  captured: [],
  lockProgress: 0,
  stepKey: 0,
  firstStep: true,
  reducedMotion: false,
};

/** Rangi (dizayn tokenlari bilan bir xil) */
export const GUIDE_COLORS = {
  bad: '#ff4d3d',
  ok: '#2e9e6b',
  pending: '#3a4048',
} as const;

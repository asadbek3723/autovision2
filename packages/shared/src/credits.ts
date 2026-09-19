/**
 * Sotuvchi AI kredit paketlari — har kredit bitta "mahsulot rasmini AI bilan
 * yaratish" chaqiruviga sarflanadi. Hozircha to'lov mock: sotib olish
 * darhol tasdiqlanadi (real Payme/Click keyinroq shu paket ro'yxatiga ulanadi).
 */
export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  priceUsd: number;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { id: 'starter', label: 'Boshlang\'ich', credits: 20, priceUsd: 5 },
  { id: 'popular', label: 'Mashhur', credits: 100, priceUsd: 20 },
  { id: 'pro', label: 'Pro', credits: 500, priceUsd: 90 },
];

export function findCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Ombordagi mahsulot shu sondan kam qolsa "tugayapti" deb ogohlantiriladi */
export const LOW_STOCK_THRESHOLD = 2;

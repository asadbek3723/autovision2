import { useSyncExternalStore } from 'react';

/**
 * Kompyuter/noutbuk: keng ekran + sichqoncha. Telefon va planshetlarda (touch) false —
 * shu sababli jonli kamera faqat telefonda, desktopda esa rasm yuklash ishlaydi.
 * Layout uchun Tailwind `lg:` (>=1024px) ishlatiladi; bu hook faqat xatti-harakat uchun.
 */
const QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Telegram Mini App SDK (window.Telegram.WebApp) ustidan yupqa qatlam */

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string } };
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  MainButton: {
    setParams(params: { text?: string; is_visible?: boolean; is_active?: boolean }): void;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const tg = (): TelegramWebApp | undefined => window.Telegram?.WebApp;

export const isTelegram = (): boolean => Boolean(tg()?.initData);

/**
 * Backendga yuboriladigan initData.
 * Brauzerda (Telegram tashqarisida) ishlab chiqish uchun soxta initData —
 * backend ALLOW_INSECURE_AUTH=true bo'lganda buni qabul qiladi.
 */
export function getInitData(): string {
  const real = tg()?.initData;
  if (real) return real;

  const devUser = { id: 999000001, first_name: 'Dev', last_name: 'Tester' };
  return new URLSearchParams({
    user: JSON.stringify(devUser),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: 'dev',
  }).toString();
}

export function initTelegram(): void {
  const app = tg();
  if (!app) return;
  app.ready();
  app.expand();
  app.setHeaderColor('#0b0c0e');
  app.setBackgroundColor('#0b0c0e');
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  tg()?.HapticFeedback?.impactOccurred(style);
}

export function notify(type: 'error' | 'success' | 'warning'): void {
  tg()?.HapticFeedback?.notificationOccurred(type);
}

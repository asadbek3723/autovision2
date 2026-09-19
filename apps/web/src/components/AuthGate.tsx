import { useEffect, useState, type ReactNode } from 'react';
import { LoginPage } from '../pages/LoginPage';
import { isTelegram } from '../lib/telegram';
import { getSessionToken } from '../lib/session';

/**
 * Telegram Mini App ichida initData bilan avtomatik autentifikatsiya
 * ishlaydi — bu holatda hech narsa ko'rsatilmaydi. Oddiy brauzerda esa
 * saqlangan sessiya tokeni bo'lmaguncha (yoki muddati tugaguncha) faqat
 * Login sahifasi ko'rsatiladi, qolgan marshrutlar ochilmaydi.
 */
const insecureDevAuth = import.meta.env.VITE_ALLOW_INSECURE_AUTH === 'true';

export function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(
    () => isTelegram() || Boolean(getSessionToken()) || insecureDevAuth
  );

  useEffect(() => {
    if (isTelegram() || insecureDevAuth) return;
    const onExpired = () => setAuthed(false);
    window.addEventListener('carvision:session-expired', onExpired);
    return () => window.removeEventListener('carvision:session-expired', onExpired);
  }, []);

  if (!authed) {
    return <LoginPage onAuthenticated={() => setAuthed(true)} />;
  }

  return <>{children}</>;
}

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Spinner } from '../components/ui/States';
import { api, ApiRequestError } from '../lib/api';
import { setSessionToken } from '../lib/session';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

interface TelegramAuthUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onCarVisionTelegramAuth?: (user: TelegramAuthUser) => void;
  }
}

/**
 * Brauzerda (Telegram Mini App tashqarisida) ochilganda ko'rsatiladi —
 * masalan sotuvchi kabinetini kompyuterdan boshqarish uchun.
 * Telegram Login Widget'dan foydalanadi: alohida parol/SMS kerak emas,
 * backend Telegram imzosini tekshirib sessiya tokeni beradi.
 */
export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const widgetHost = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!BOT_USERNAME) return;

    window.onCarVisionTelegramAuth = (user) => {
      setStatus('verifying');
      setError(null);

      const payload: Record<string, string> = {
        id: String(user.id),
        auth_date: String(user.auth_date),
        hash: user.hash,
      };
      if (user.first_name) payload.first_name = user.first_name;
      if (user.last_name) payload.last_name = user.last_name;
      if (user.username) payload.username = user.username;
      if (user.photo_url) payload.photo_url = user.photo_url;

      (api as any)
        .telegramLogin(payload)
        .then(({ token }: { token: string }) => {
          setSessionToken(token);
          onAuthenticated();
        })
        .catch((err: unknown) => {
          setStatus('error');
          setError(err instanceof ApiRequestError ? err.message : 'Kirish muvaffaqiyatsiz tugadi');
        });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onCarVisionTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    widgetHost.current?.appendChild(script);

    return () => {
      delete window.onCarVisionTelegramAuth;
    };
  }, [onAuthenticated]);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col px-6 pt-16 pb-10">
      <div className="mb-10 flex items-center gap-3">
        <img src="/logo.png" alt="CarVision" className="h-10 w-10 rounded-lg object-contain" />
        <span className="text-[17px] font-medium tracking-[0.2em]">CARVISION</span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div
          className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent-soft"
          aria-hidden="true"
        >
          <Icon name="shield" size={28} />
        </div>

        <h1 className="t-hero mb-3 text-center text-[30px]">Xush kelibsiz</h1>
        <p className="mx-auto mb-10 max-w-[22rem] text-center text-[15px] leading-relaxed text-text-muted">
          Sotuvchi kabinetini kompyuterdan boshqarish uchun Telegram orqali kiring.
        </p>

        <div className="flex flex-col items-center gap-4">
          {status === 'verifying' && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-5 py-3.5">
              <Spinner size={18} />
              <span className="text-sm text-text-muted">Tasdiqlanmoqda…</span>
            </div>
          )}

          <div ref={widgetHost} className={status === 'verifying' ? 'hidden' : ''} />

          {!BOT_USERNAME && (
            <p className="max-w-xs text-center text-sm text-text-subtle">
              Login vidjeti sozlanmagan — <code className="text-text-muted">VITE_TELEGRAM_BOT_USERNAME</code>{' '}
              muhit o'zgaruvchisini qo'shing.
            </p>
          )}

          {error && (
            <p className="flex max-w-xs items-start gap-1.5 text-center text-sm text-danger">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>

      <p className="text-center text-[12px] text-text-subtle">
        Telegram Mini App ichida ochsangiz, kirish avtomatik amalga oshadi.
      </p>
    </div>
  );
}

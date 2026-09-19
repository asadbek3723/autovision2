import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { UserRole } from '@carvision/shared';
import { useAuth } from './useAuth';
import { Spinner } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { AUTH_ENABLED } from '../lib/config';

export function AuthLoadingScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="relative flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl animate-pulse" />
        <Spinner className="w-8 h-8 text-accent relative z-10" />
      </div>
      <p className="t-body text-text-muted font-medium animate-pulse">Yuklanmoqda...</p>
    </div>
  );
}

/** Auth o'chiq holatda mehmon sessiyasi yaratilmasa (tarmoq/server xatosi) ko'rsatiladi */
function GuestSessionFailedScreen() {
  const { refresh } = useAuth();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-bg p-6 text-center">
      <h1 className="t-h1 mb-2">Ulanib bo‘lmadi</h1>
      <p className="t-caption mb-6 max-w-xs">
        Serverga ulanishda muammo bor. Internetni tekshirib, qaytadan urinib ko‘ring.
      </p>
      <Button onClick={() => void refresh()}>Qayta urinish</Button>
    </div>
  );
}

/**
 * Autentifikatsiya talab qiluvchi sahifalar uchun guard.
 * Mehmon bo'lsa /auth ga yo'naltiradi.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoadingScreen />;
  if (status === 'guest') {
    // Auth o'chiq: /auth ga yo'naltirmaymiz — mehmon sessiyasi hosil bo'lishini kutamiz
    if (!AUTH_ENABLED) return <GuestSessionFailedScreen />;
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

/**
 * Muayyan rol talab qiluvchi sahifalar uchun guard.
 * - Noto'g'ri rol: o'z bosh sahifasiga yo'naltiradi
 * - seller → /seller, user → /
 */
export function RequireRole({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') return <AuthLoadingScreen />;

  if (status === 'guest') {
    return <Navigate to="/auth" replace />;
  }

  // Admin har qanday sahifaga kira oladi
  if (user?.role === 'admin') return <>{children}</>;

  // User roli so'ralgan sahifalarga oddiy foydalanuvchi HAM, sotuvchi HAM kira oladi
  if (role === 'user' && (user?.role === 'user' || user?.role === 'seller')) {
    return <>{children}</>;
  }

  // Seller roli so'ralgan sahifalarga faqat seller va admin kira oladi
  if (role === 'seller' && user?.role === 'seller') {
    return <>{children}</>;
  }

  // Noto'g'ri rol — o'zining tegishli bosh sahifasiga yo'naltiriladi
  return <Navigate to={user?.role === 'seller' ? '/seller' : '/'} replace />;
}

/**
 * Faqat mehmonlar uchun sahifalar (masalan: /auth).
 * Kirgan foydalanuvchi o'z bosh sahifasiga yo'naltiriladi.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoadingScreen />;

  // Auth o'chiq: /auth sahifasi yo'q — to'g'ri asosiy sahifaga
  if (!AUTH_ENABLED) return <Navigate to="/" replace />;

  if (status !== 'guest') {
    // Avvalgi manzil bo'lsa, o'sha joyga qaytarish
    const from = (location.state as { from?: string })?.from;
    if (from && from !== '/auth') return <Navigate to={from} replace />;
    return <Navigate to={user?.role === 'seller' ? '/seller' : '/'} replace />;
  }

  return <>{children}</>;
}

import { useMemo } from 'react';

const COMMON_PASSWORDS = new Set([
  '12345678',
  'password',
  '123456789',
  'qwertyuiop',
  '1234567890',
  'carvision',
  'password123',
  'admin123',
]);

interface StrengthMeterProps {
  password: string;
  login?: string;
}

export function StrengthMeter({ password, login }: StrengthMeterProps) {
  const { score, label, colorClass } = useMemo(() => {
    if (!password) return { score: 0, label: '', colorClass: '' };

    const lower = password.toLowerCase();
    const cleanLogin = login?.trim().toLowerCase();

    if (COMMON_PASSWORDS.has(lower) || (cleanLogin && lower === cleanLogin)) {
      return { score: 1, label: 'Juda oson topiladi', colorClass: 'bg-danger text-danger' };
    }

    let s = 0;
    if (password.length >= 8) s += 1;
    if (password.length >= 12) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) s += 1;

    const clamped = Math.max(1, Math.min(4, s));

    switch (clamped) {
      case 1:
        return { score: 1, label: 'Zaif', colorClass: 'bg-danger text-danger' };
      case 2:
        return { score: 2, label: 'Oʻrtacha', colorClass: 'bg-warning text-warning' };
      case 3:
        return { score: 3, label: 'Yaxshi', colorClass: 'bg-accent text-accent-soft' };
      case 4:
      default:
        return { score: 4, label: 'Kuchli', colorClass: 'bg-success text-success' };
    }
  }, [password, login]);

  if (!password) return null;

  return (
    <div className="mt-2.5 animate-fadeIn">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              seg <= score ? colorClass.split(' ')[0] : 'bg-border-strong/40'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="t-caption text-text-muted">Parol mustahkamligi:</span>
        <span className={`t-caption font-semibold ${colorClass.split(' ')[1]}`}>{label}</span>
      </div>
    </div>
  );
}

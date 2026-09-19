import type { HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/format';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ Card */
/** Reja 23: 16px radius, yengil surface separation, 16–24px padding, shadowsiz */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('rounded-lg border border-border bg-surface', className)}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Input */
interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-sm font-medium text-text">{label}</span>}
      {children}
      {error ? (
        <span className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <Icon name="alert" size={14} />
          {error}
        </span>
      ) : (
        hint && <span className="mt-2 block text-sm text-text-subtle">{hint}</span>
      )}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-border bg-surface px-4 py-3 text-text ' +
  'placeholder:text-text-subtle outline-none transition-colors ' +
  'focus:border-accent focus:ring-1 focus:ring-accent';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(CONTROL, className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(CONTROL, 'min-h-24 resize-none', className)} />;
}

/* ------------------------------------------------------------------ Chip */
interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  swatch?: string;
  children: ReactNode;
}

/** Reja 23: filterlarni tez skan qilish uchun; ekranni to'ldirmaydi */
export function Chip({ selected, onClick, swatch, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm',
        'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
        selected
          ? 'border-accent bg-accent/12 text-text'
          : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
      )}
    >
      {swatch && (
        <span
          className="h-4 w-4 shrink-0 rounded-sm border border-white/15"
          style={{ backgroundColor: swatch }}
        />
      )}
      {children}
      {/* Rang yagona belgi bo'lmasligi uchun tanlangan holat ikonka bilan ham beriladi */}
      {selected && <Icon name="check" size={14} className="text-accent-soft" />}
    </button>
  );
}

/* ----------------------------------------------------------------- Badge */
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-muted border-border',
  success: 'bg-success/12 text-success border-success/30',
  warning: 'bg-warning/12 text-warning border-warning/30',
  danger: 'bg-danger/12 text-danger border-danger/30',
  accent: 'bg-accent/12 text-accent-soft border-accent/30',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium',
        TONES[tone]
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Section */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="t-h2">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/format';
import { haptic } from '../../lib/haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

/**
 * Reja 23-bo'limi: 16px radius, primary action aniq ajraladi,
 * horizontal padding vertikaldan katta, katta touch target (Fitts's Law).
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-strong active:bg-accent-strong disabled:bg-accent/40',
  secondary:
    'bg-surface-2 text-text border border-border hover:border-border-strong active:bg-surface',
  ghost: 'bg-transparent text-text-muted hover:text-text active:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-md',
  md: 'h-12 px-6 rounded-lg',
  lg: 'h-14 px-8 text-base rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={(event) => {
        haptic('light');
        onClick?.(event);
      }}
      className={cn(
        // Keng tugma block-level bo'ladi: `inline-flex` matn bazasidan ortiqcha
        // bo'shliq olib, ostidagi layoutni suradi.
        fullWidth ? 'flex w-full' : 'inline-flex',
        'items-center justify-center gap-2 font-medium',
        'transition-colors duration-150 outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

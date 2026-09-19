import type { ReactNode } from 'react';
import { cn } from '../../lib/format';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

/**
 * Reja 30-bo'limi: loading, empty, error va success holatlari.
 * Xato texnik emas — foydalanuvchi nima qilishi kerakligini tushuntiradi.
 */

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-border border-t-accent',
        className
      )}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Yuklanmoqda"
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-surface-2 shimmer', className)} />
  );
}

interface StateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function EmptyState({ icon = 'package', title, description, action }: StateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-surface text-text-subtle">
        <Icon name={icon} size={24} />
      </div>
      <p className="t-h2 mb-2">{title}</p>
      {description && <p className="t-caption max-w-xs">{description}</p>}
      {action && (
        <Button className="mt-6" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Nimadir noto‘g‘ri ketdi',
  description = 'Internet aloqasini tekshiring va qaytadan urinib ko‘ring.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger">
        <Icon name="alert" size={24} />
      </div>
      <p className="t-h2 mb-2">{title}</p>
      <p className="t-caption max-w-xs">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          <Icon name="refresh" size={16} />
          Qaytadan urinish
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Spinner size={24} />
      <p className="t-caption">{label}</p>
    </div>
  );
}

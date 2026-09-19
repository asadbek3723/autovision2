import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Reja 23 uslubiga mos yengil pastdan chiquvchi panel — forma va tasdiqlar uchun */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-bg sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="t-h2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors active:bg-surface-2"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 safe-bottom">{children}</div>
      </div>
    </div>
  );
}

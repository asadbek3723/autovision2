import { useEffect, useId } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'accent';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Tasdiqlash',
  cancelText = 'Bekor qilish',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-desc`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-[400px] rounded-2xl bg-surface border border-border p-6 shadow-2xl animate-scaleUp">
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
            }`}
          >
            <Icon name="alert" className="w-5 h-5" />
          </div>
          <div>
            <h3 id={`${id}-title`} className="t-h2 font-semibold text-text">
              {title}
            </h3>
            <p id={`${id}-desc`} className="t-body text-text-muted mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="ghost" fullWidth onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            fullWidth
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

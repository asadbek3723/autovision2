import { cn } from '../../lib/format';
import type { CriterionId } from '../../capture/criteria';

interface CriteriaPipsProps {
  passes: Record<CriterionId, boolean>;
  soft?: Record<CriterionId, boolean>;
  className?: string;
}

const CRITERIA_ITEMS: { id: CriterionId; label: string }[] = [
  { id: 'car', label: 'Mashina' },
  { id: 'angle', label: 'Burchak' },
  { id: 'distance', label: 'Masofa' },
  { id: 'height', label: 'Balandlik' },
  { id: 'steady', label: 'Barqaror' },
];

export function CriteriaPips({ passes, soft, className }: CriteriaPipsProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-full bg-black/60 px-4 py-1.5 backdrop-blur border border-white/10',
        className
      )}
    >
      {CRITERIA_ITEMS.map((item) => {
        const pass = passes[item.id];
        const isSoft = soft?.[item.id];

        return (
          <div key={item.id} className="flex items-center gap-1.5 text-[11px] font-medium">
            <span
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                pass
                  ? 'bg-success'
                  : isSoft
                  ? 'bg-warning'
                  : 'bg-danger'
              )}
            />
            <span className={pass ? 'text-white' : 'text-white/50'}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

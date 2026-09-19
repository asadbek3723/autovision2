import { haptic } from '../../lib/haptics';

interface Option<T extends string> {
  id: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Tanlov',
}: SegmentedProps<T>) {
  const handleSelect = (id: T) => {
    haptic('selection');
    onChange(id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="h-12 w-full p-1 rounded-2xl bg-surface border border-border flex items-center gap-1 select-none"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleSelect(option.id)}
            className={`h-10 flex-1 rounded-xl t-caption font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
              active
                ? 'bg-surface-2 text-text border border-border-strong shadow-sm scale-[1.01]'
                : 'text-text-muted hover:text-text hover:bg-surface-2/40'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

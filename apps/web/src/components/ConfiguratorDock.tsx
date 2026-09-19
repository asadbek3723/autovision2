import { useRef, type ReactNode } from 'react';
import { cn } from '../lib/format';
import { haptic } from '../lib/haptics';
import { Icon } from './ui/Icon';

/**
 * Mobil konfigurator doki — reja 24-bo'limi (Hick's Law, progressive disclosure):
 * pastda kuzov qismlari bo'limlari, ustida faqat tanlangan bo'limning
 * variantlari. Ikkala qator ham yon tomonga suriladi, bir ekranda
 * foydalanuvchiga barcha variant birdan ko'rsatilmaydi.
 */

/** Doktdagi bitta variant: rang (swatch) yoki katalog mahsuloti (rasm + narx) */
export interface DockOption {
  /** Rang uchun variant kodi, mahsulot uchun — mahsulot id'si */
  value: string;
  label: string;
  swatch?: string;
  /** Katalog mahsulotining fon-siz rasmi */
  image?: string | null;
  /** Masalan narx */
  caption?: string;
}

export interface DockGroup {
  key: string;
  label: string;
  options: DockOption[];
}

function OptionCard({
  option,
  groupLabel,
  selected,
  onClick,
}: {
  option: DockOption | null;
  groupLabel: string;
  selected: boolean;
  onClick: () => void;
}) {
  const label = option?.label ?? "Yo'q";

  return (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        onClick();
      }}
      aria-pressed={selected}
      aria-label={`${groupLabel}: ${label}`}
      className={cn(
        'relative shrink-0 snap-start rounded-lg border p-2 text-left transition-colors lg:w-auto lg:p-2.5',
        option?.image ? 'w-[112px]' : 'w-[88px]',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface-2 hover:border-border-strong'
      )}
    >
      <span
        className={cn(
          'mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-white/8',
          option?.image && 'bg-[#eef0f3]'
        )}
        style={option?.swatch ? { backgroundColor: option.swatch } : undefined}
      >
        {!option && <Icon name="x" size={18} className="text-text-subtle" />}
        {option?.image && (
          <img
            src={option.image}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-contain p-1.5"
          />
        )}
        {option && !option.swatch && !option.image && (
          <Icon name="car" size={20} className="text-text-subtle" />
        )}
      </span>

      <span
        className={cn(
          'line-clamp-2 block text-[11px] leading-tight lg:text-[13px]',
          selected ? 'text-text' : 'text-text-muted'
        )}
      >
        {label}
      </span>
      {option?.caption && (
        <span className="mt-1 block text-[11px] font-semibold text-accent-soft tabular-nums lg:text-[12px]">
          {option.caption}
        </span>
      )}

      {selected && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="check" size={10} strokeWidth={2.4} />
        </span>
      )}
    </button>
  );
}

interface ConfiguratorDockProps {
  groups: DockGroup[];
  activeKey: string;
  options: Record<string, string>;
  onSelectGroup: (key: string) => void;
  onSelectOption: (groupKey: string, value: string | null) => void;
  children?: ReactNode;
}

export function ConfiguratorDock({
  groups,
  activeKey,
  options,
  onSelectGroup,
  onSelectOption,
  children,
}: ConfiguratorDockProps) {
  const optionsRef = useRef<HTMLDivElement>(null);

  const activeGroup = groups.find((group) => group.key === activeKey) ?? groups[0];
  if (!activeGroup) return null;
  const activeValue = options[activeGroup.key];

  return (
    <div className="shrink-0 border-t border-border bg-surface lg:flex lg:h-full lg:w-[440px] lg:flex-col lg:border-t-0 lg:border-l xl:w-[480px]">
      {/* Faqat desktop: panel sarlavhasi */}
      <p className="hidden px-6 pt-6 pb-1 text-[12px] font-semibold tracking-[0.18em] text-text-subtle uppercase lg:block">
        Avtomobil qismlari
      </p>

      {/* ------------------------------------- bo'limlar (yon tomonga surish) */}
      <div
        className="-mb-px flex gap-1 overflow-x-auto border-b border-border px-4 lg:mb-0 lg:shrink-0 lg:flex-wrap lg:gap-2 lg:overflow-visible lg:border-b-0 lg:px-6 lg:py-3"
        role="tablist"
        aria-label="Avtomobil qismlari"
      >
        {groups.map((group) => {
          const isActive = group.key === activeGroup.key;
          const hasSelection = Boolean(options[group.key]);

          return (
            <button
              key={group.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                haptic('light');
                onSelectGroup(group.key);
                optionsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors',
                'lg:rounded-full lg:border lg:px-4 lg:py-2',
                isActive
                  ? 'border-accent text-text lg:bg-accent/10'
                  : 'border-transparent text-text-muted hover:text-text lg:border-border lg:hover:border-border-strong'
              )}
            >
              {group.label}
              {/* Tanlangan bo'lim rangdan tashqari nuqta bilan ham belgilanadi */}
              {hasSelection && (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isActive ? 'bg-accent' : 'bg-accent-soft'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* --------------------------------- variantlar (yon tomonga surish) */}
      <div
        ref={optionsRef}
        className="flex snap-x gap-2 overflow-x-auto px-4 py-3 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:content-start lg:gap-3 lg:overflow-x-visible lg:overflow-y-auto lg:px-6 lg:py-4"
        role="tabpanel"
        aria-label={activeGroup.label}
      >
        <OptionCard
          option={null}
          groupLabel={activeGroup.label}
          selected={!activeValue}
          onClick={() => onSelectOption(activeGroup.key, null)}
        />
        {activeGroup.options.map((option) => (
          <OptionCard
            key={option.value}
            option={option}
            groupLabel={activeGroup.label}
            selected={activeValue === option.value}
            onClick={() => onSelectOption(activeGroup.key, option.value)}
          />
        ))}
      </div>

      {children && <div className="lg:shrink-0 lg:border-t lg:border-border">{children}</div>}
    </div>
  );
}

import { useRef, type ReactNode } from 'react';
import { CUSTOMIZATION_GROUPS, type CustomizationOption } from '@carvision/shared';
import { cn } from '../lib/format';
import { haptic } from '../lib/telegram';
import { Icon } from './ui/Icon';

/**
 * Mobil konfigurator doki — reja 24-bo'limi (Hick's Law, progressive disclosure):
 * pastda kuzov qismlari bo'limlari, ustida faqat tanlangan bo'limning
 * variantlari. Ikkala qator ham yon tomonga suriladi, bir ekranda
 * foydalanuvchiga barcha variant birdan ko'rsatilmaydi.
 */

function OptionCard({
  option,
  groupLabel,
  selected,
  onClick,
}: {
  option: CustomizationOption | null;
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
        'relative w-[88px] shrink-0 snap-start rounded-lg border p-2 text-left transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent-soft',
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface-2 hover:border-border-strong'
      )}
    >
      <span
        className="mb-2 flex aspect-square w-full items-center justify-center rounded-md border border-white/8"
        style={option?.swatch ? { backgroundColor: option.swatch } : undefined}
      >
        {!option && <Icon name="x" size={18} className="text-text-subtle" />}
        {option && !option.swatch && (
          <Icon name="car" size={20} className="text-text-subtle" />
        )}
      </span>

      <span
        className={cn(
          'block text-[11px] leading-tight',
          selected ? 'text-text' : 'text-text-muted'
        )}
      >
        {label}
      </span>

      {selected && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="check" size={10} strokeWidth={2.4} />
        </span>
      )}
    </button>
  );
}

interface ConfiguratorDockProps {
  activeKey: string;
  options: Record<string, string>;
  onSelectGroup: (key: string) => void;
  onSelectOption: (groupKey: string, value: string | null) => void;
  children?: ReactNode;
}

export function ConfiguratorDock({
  activeKey,
  options,
  onSelectGroup,
  onSelectOption,
  children,
}: ConfiguratorDockProps) {
  const optionsRef = useRef<HTMLDivElement>(null);

  const activeGroup =
    CUSTOMIZATION_GROUPS.find((group) => group.key === activeKey) ?? CUSTOMIZATION_GROUPS[0]!;
  const activeValue = options[activeGroup.key];

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {/* ------------------------------------- bo'limlar (yon tomonga surish) */}
      <div
        className="-mb-px flex gap-1 overflow-x-auto border-b border-border px-4"
        role="tablist"
        aria-label="Avtomobil qismlari"
      >
        {CUSTOMIZATION_GROUPS.map((group) => {
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
                isActive
                  ? 'border-accent text-text'
                  : 'border-transparent text-text-muted hover:text-text'
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
        className="flex snap-x gap-2 overflow-x-auto px-4 py-3"
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

      {children}
    </div>
  );
}

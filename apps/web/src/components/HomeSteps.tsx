import { REQUIRED_CAR_PHOTOS } from '@carvision/shared';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Icon, type IconName } from './ui/Icon';

/**
 * Asosiy sahifadagi uch qadam — kartochka ko'rinishida.
 * Har birida tartib raqami, ikonka plitasi, sarlavha, bitta qatorlik izoh
 * va o'ngda yo'nalish belgisi.
 */

const STEPS: { n: string; icon: IconName; title: string; text: string }[] = [
  {
    n: '01',
    icon: 'car',
    title: 'Suratga oling',
    text: `${REQUIRED_CAR_PHOTOS} rakurs — kamera yo‘naltiradi`,
  },
  { n: '02', icon: 'brush', title: 'Tanlang', text: 'Disk, far, bamper, rang' },
  { n: '03', icon: 'sparkles', title: 'Ko‘ring', text: 'Natija o‘z mashinangizda' },
];

/** Noutbukda kamera yo'q — birinchi qadam rasm yuklash sifatida ko'rsatiladi */
const DESKTOP_FIRST_STEP = {
  title: 'Rasm yuklang',
  text: 'Mashina rasmlarini fayldan tanlang',
};

export function HomeSteps({ baseDelay = 0 }: { baseDelay?: number }) {
  const isDesktop = useIsDesktop();
  const steps = STEPS.map((step, index) =>
    isDesktop && index === 0 ? { ...step, ...DESKTOP_FIRST_STEP } : step
  );

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li
          key={step.n}
          className="cv-rise flex items-center gap-3.5 rounded-[20px] border border-border/70 bg-surface/70 p-3.5"
          style={{ animationDelay: `${baseDelay + index * 90}ms` }}
        >
          <span className="w-5 shrink-0 text-[12px] font-medium text-text-subtle tabular-nums">
            {step.n}
          </span>

          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-white"
            style={{
              background:
                index === 0
                  ? 'linear-gradient(145deg, #4a80ff, #1d46b8)'
                  : 'linear-gradient(145deg, rgb(47 107 255 / 0.30), rgb(47 107 255 / 0.10))',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.18)',
            }}
          >
            <Icon name={step.icon} size={24} className={index === 0 ? '' : 'text-accent-soft'} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[17px] leading-tight font-semibold">
              {step.title}
            </span>
            <span className="block truncate text-[14px] text-text-muted">{step.text}</span>
          </span>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-muted">
            <Icon name="arrow-right" size={16} />
          </span>
        </li>
      ))}
    </ol>
  );
}

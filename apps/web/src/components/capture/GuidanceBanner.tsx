import { Icon, type IconName } from '../ui/Icon';
import { cn } from '../../lib/format';

interface GuidanceBannerProps {
  message: string;
  iconName?: IconName;
  ready: boolean;
  className?: string;
}

export function GuidanceBanner({
  message,
  iconName = 'info',
  ready,
  className,
}: GuidanceBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-5 py-3.5 backdrop-blur transition-all duration-300',
        ready ? 'bg-success/20 border border-success/40' : 'bg-black/60 border border-white/10',
        className
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
          ready ? 'bg-success text-white' : 'bg-white/10 text-white/90'
        )}
      >
        <Icon name={ready ? 'check' : iconName} size={24} />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[20px] leading-tight font-semibold tracking-[-0.01em] transition-colors',
            ready ? 'text-success-soft' : 'text-white'
          )}
        >
          {ready ? 'Tayyor — ushlab turing' : message}
        </p>
      </div>
    </div>
  );
}

import type { UserRole } from '@carvision/shared';
import { Icon } from '../ui/Icon';
import { haptic } from '../../lib/haptics';

interface RoleCardProps {
  role: UserRole;
  selected: boolean;
  onSelect: (role: UserRole) => void;
}

export function RoleCard({ role, selected, onSelect }: RoleCardProps) {
  const isSeller = role === 'seller';

  const handleClick = () => {
    haptic('selection');
    onSelect(role);
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={handleClick}
      className={`group relative min-h-[72px] w-full p-4 rounded-xl border text-left flex items-center gap-3.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
        selected
          ? 'border-accent bg-accent/10 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.01]'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2 hover:scale-[1.005]'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
          selected ? 'bg-accent text-white shadow-md' : 'bg-surface-2 text-text-muted group-hover:text-text'
        }`}
      >
        <Icon name={isSeller ? 'store' : 'user'} className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="t-body font-semibold text-text tracking-tight">
          {isSeller ? 'Avto-servis egasi' : 'Oddiy foydalanuvchi'}
        </p>
        <p className="t-caption text-text-muted mt-0.5 line-clamp-1">
          {isSeller
            ? 'Mahsulot qoʻshaman, buyurtmalarni qabul qilaman'
            : 'Mashinamni vizuallashtiraman, ehtiyot qism sotib olaman'}
        </p>
      </div>

      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
          selected ? 'border-accent bg-accent text-white scale-110' : 'border-border-strong bg-transparent'
        }`}
      >
        {selected && <Icon name="check" className="w-3.5 h-3.5 stroke-[2.5]" />}
      </div>
    </button>
  );
}

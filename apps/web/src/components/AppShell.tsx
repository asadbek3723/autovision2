import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { Icon, type IconName } from './ui/Icon';

/** Reja 23: bottom navigation 3–5 ta eng muhim destination bilan cheklanadi */
const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Studio', icon: 'wand' },
  { to: '/market', label: 'Katalog', icon: 'grid' },
  { to: '/cart', label: 'Savat', icon: 'cart' },
  { to: '/profile', label: 'Profil', icon: 'user' },
];

function BottomNav() {
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: api.cart });
  const { data: meData } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const count = cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const isSeller = meData?.user.role === 'seller' || Boolean(meData?.seller);

  const navItems: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: 'Studio', icon: 'wand' },
    { to: '/market', label: 'Katalog', icon: 'grid' },
    { to: '/cart', label: 'Savat', icon: 'cart' },
    ...(isSeller ? [{ to: '/seller' as const, label: 'Kabinet', icon: 'store' as IconName }] : []),
    { to: '/profile', label: 'Profil', icon: 'user' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 min-h-[var(--nav-h)] border-t border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg safe-bottom pt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-1 pt-1 pb-2 text-xs transition-colors',
                isActive ? 'text-accent' : 'text-text-subtle'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon name={item.icon} size={22} strokeWidth={isActive ? 1.9 : 1.6} />
                  {item.to === '/cart' && count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-white">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>
                {item.label}
                {/* Faol bo'limning ostidagi qisqa accent chizig'i */}
                <span
                  className={cn(
                    'absolute bottom-0 h-[3px] w-5 rounded-full transition-opacity',
                    isActive ? 'bg-accent opacity-100' : 'opacity-0'
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

interface HeaderProps {
  title?: string;
  back?: boolean;
  action?: ReactNode;
}

export function Header({ title, back = true, action }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/');
          }
        }}
        aria-label="Orqaga"
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text active:bg-surface"
      >
        <Icon name="chevron-left" size={22} />
      </button>
      <h1 className="t-h2 flex-1 truncate">{title || 'CarVision'}</h1>
      {action}
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const hideNav = pathname.startsWith('/capture');
  // Studio konfigurator o'z balandligini boshqaradi — pastdan qo'shimcha joy kerak emas
  const fullBleed = pathname === '/';

  // Kam o'zgaradigan ma'lumotlarni ilova ochilishi bilanoq oldindan yuklab qo'yamiz
  useEffect(() => {
    queryClient.prefetchQuery({ queryKey: ['me'], queryFn: api.me });
    queryClient.prefetchQuery({ queryKey: ['categories'], queryFn: api.categories });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className={cn('flex-1', hideNav ? 'pb-8' : fullBleed ? '' : 'pb-24')}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

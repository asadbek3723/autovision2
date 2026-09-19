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

function useNavState() {
  const { data: cartData } = useQuery({ queryKey: ['cart'], queryFn: api.cart });
  const { data: meData } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const count = cartData?.cart.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const isSeller = meData?.user.role === 'seller' || Boolean(meData?.seller);
  return { count, isSeller };
}

/**
 * Desktop (lg+) yuqori navigatsiya paneli. Mobil pastki navigatsiya (BottomNav) bilan
 * bir vaqtda ko'rinmaydi — ikkalasi ham faqat o'z breakpoint'ida chiqadi.
 */
function TopNav() {
  const { count, isSeller } = useNavState();
  const navigate = useNavigate();

  const links: { to: string; label: string }[] = [
    { to: '/', label: 'Studio' },
    { to: '/market', label: 'Katalog' },
    ...(isSeller ? [{ to: '/seller', label: 'Kabinet' }] : []),
  ];

  const iconLink = (isActive: boolean) =>
    cn(
      'relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
      isActive
        ? 'border-accent/50 bg-accent/10 text-text'
        : 'border-border bg-surface/60 text-text-muted hover:border-border-strong hover:text-text'
    );

  return (
    <header className="sticky top-0 z-40 hidden h-[var(--nav-h)] border-b border-border/70 bg-bg/80 backdrop-blur-xl lg:block">
      <div className="mx-auto flex h-full max-w-[1240px] items-center gap-8 px-10">
        <NavLink to="/" className="flex shrink-0 items-center gap-3">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-md object-contain" />
          <span className="text-[15px] font-medium tracking-[0.24em] text-text">CARVISION</span>
        </NavLink>

        <nav className="flex items-center gap-1" aria-label="Asosiy navigatsiya">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-2 text-[14px] font-medium transition-colors',
                  isActive
                    ? 'bg-surface-2 text-text'
                    : 'text-text-muted hover:bg-surface/70 hover:text-text'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <NavLink to="/cart" aria-label="Savat" className={({ isActive }) => iconLink(isActive)}>
            <Icon name="cart" size={18} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-semibold text-white">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </NavLink>
          <NavLink to="/profile" aria-label="Profil" className={({ isActive }) => iconLink(isActive)}>
            <Icon name="user" size={18} />
          </NavLink>

          <button
            type="button"
            onClick={() => navigate('/capture')}
            className="cv-cta relative ml-1 inline-flex h-10 items-center gap-2 overflow-hidden rounded-full px-5 text-[14px] font-semibold text-white transition-transform duration-150 active:scale-[0.985]"
          >
            <Icon name="upload" size={16} />
            Rasm yuklash
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { count, isSeller } = useNavState();

  const navItems: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: 'Studio', icon: 'wand' },
    { to: '/market', label: 'Katalog', icon: 'grid' },
    { to: '/cart', label: 'Savat', icon: 'cart' },
    ...(isSeller ? [{ to: '/seller' as const, label: 'Kabinet', icon: 'store' as IconName }] : []),
    { to: '/profile', label: 'Profil', icon: 'user' },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 min-h-[var(--nav-h)] border-t border-border bg-bg/95 backdrop-blur lg:hidden">
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur lg:static lg:h-auto lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-10 lg:pb-2 lg:backdrop-blur-none">
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
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text active:bg-surface lg:ml-0 lg:rounded-full lg:border lg:border-border lg:bg-surface/60 lg:hover:border-border-strong"
      >
        <Icon name="chevron-left" size={22} />
      </button>
      <h1 className="t-h2 flex-1 truncate lg:text-[32px] lg:leading-tight lg:font-semibold lg:tracking-[-0.03em]">
        {title || 'CarVision'}
      </h1>
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
    <div className="mx-auto flex min-h-full max-w-lg flex-col lg:max-w-none">
      {!hideNav && <TopNav />}
      <main className={cn('flex-1', hideNav ? 'pb-8' : fullBleed ? '' : 'pb-24 lg:pb-20')}>
        {/* Desktopda kontent markazlashgan keng konteynerda; mobilda bu div ta'sir qilmaydi */}
        <div className={cn(!fullBleed && 'lg:mx-auto lg:w-full lg:max-w-[1240px] lg:px-10')}>
          {children}
        </div>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}

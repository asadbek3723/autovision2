import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAuth } from '../auth/useAuth';
import { AUTH_ENABLED } from '../lib/config';
import { useStudio } from '../store/useStudio';
import { Header } from '../components/AppShell';
import { Card } from '../components/ui/Primitives';
import { Icon, type IconName } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/States';

function Row({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 px-4 py-4 transition-colors active:bg-surface-2"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {subtitle && <span className="t-caption block truncate">{subtitle}</span>}
      </span>
      <Icon name="chevron-right" size={18} className="shrink-0 text-text-subtle" />
    </Link>
  );
}

export function ProfilePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const generations = useQuery({ queryKey: ['generations'], queryFn: api.generations });
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  // Chiqishda oldingi foydalanuvchining ma'lumotlari (keshlangan so'rovlar va
  // Studio'dagi mashina) keyingi kirgan foydalanuvchiga ko'rinib qolmasligi kerak.
  const handleLogout = async () => {
    await logout();
    useStudio.getState().reset();
    queryClient.clear();
  };

  return (
    <>
      <Header title="Profil" />

      <div className="px-4 pt-4 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-0 lg:pt-6">
        <div className="lg:sticky lg:top-24">
        <Card className="mb-6 p-4 lg:p-5">
          {me.isLoading ? (
            <Skeleton className="h-12" />
          ) : (
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                <Icon name="user" size={22} />
              </span>
              <div className="min-w-0">
                <p className="font-medium">{me.data?.user.name ?? 'Foydalanuvchi'}</p>
                <p className="t-caption truncate">
                  {me.data?.user.phone ?? 'Telefon raqam kiritilmagan'}
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className="mb-6 divide-y divide-border p-0">
          <Row to="/orders" icon="package" title="Buyurtmalarim" />
          {/* Auth o'chiq: mehmonda sotuvchi kabineti yo'q — o'lik havola ko'rsatilmaydi */}
          {(AUTH_ENABLED || me.data?.user.role === 'seller') && (
            <Row
              to="/seller"
              icon="store"
              title="Sotuvchi kabineti"
              subtitle={me.data?.seller?.business_name ?? 'B2B dashboard'}
            />
          )}
        </Card>
        </div>

        {/* Reja 5: bir nechta konfiguratsiyani yaratish va taqqoslash */}
        <section>
          <h2 className="t-h2 mb-3">Mening konfiguratsiyalarim</h2>

          {generations.isLoading ? (
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 lg:gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : generations.data?.generations.length ? (
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 lg:gap-4">
              {generations.data.generations
                .filter((g) => g.generated_image)
                .map((generation) => (
                  <figure key={generation.id} className="overflow-hidden rounded-md bg-surface-2">
                    <img
                      src={generation.generated_image!}
                      alt="Konfiguratsiya"
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                    <figcaption className="px-2 py-1.5 text-[11px] text-text-subtle">
                      {formatDate(generation.created_at)}
                    </figcaption>
                  </figure>
                ))}
            </div>
          ) : (
            <Card className="p-6">
              <p className="t-caption text-center">
                Hali konfiguratsiya yo‘q. Studioda birinchi natijani yarating.
              </p>
            </Card>
          )}
        </section>

        {AUTH_ENABLED && (
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-6 flex min-h-11 w-full items-center justify-center gap-1.5 py-3 text-sm text-danger lg:col-start-1 lg:mt-0"
          >
            <Icon name="x" size={14} />
            Chiqish
          </button>
        )}
      </div>
    </>
  );
}

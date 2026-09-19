import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { isTelegram } from '../lib/telegram';
import { clearSessionToken, getSessionToken } from '../lib/session';
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
  const showLogout = !isTelegram() && Boolean(getSessionToken());

  return (
    <>
      <Header title="Profil" />

      <div className="px-4 pt-4">
        <Card className="mb-6 p-4">
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
          <Row
            to="/seller"
            icon="store"
            title="Sotuvchi kabineti"
            subtitle={me.data?.seller?.business_name ?? 'B2B dashboard'}
          />
        </Card>

        {/* Reja 5: bir nechta konfiguratsiyani yaratish va taqqoslash */}
        <section>
          <h2 className="t-h2 mb-3">Mening konfiguratsiyalarim</h2>

          {generations.isLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : generations.data?.generations.length ? (
            <div className="grid grid-cols-3 gap-2">
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

        {showLogout && (
          <button
            type="button"
            onClick={() => {
              clearSessionToken();
              window.location.reload();
            }}
            className="mt-6 flex w-full items-center justify-center gap-1.5 py-3 text-sm text-danger"
          >
            <Icon name="x" size={14} />
            Chiqish
          </button>
        )}
      </div>
    </>
  );
}

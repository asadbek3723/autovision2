import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  LOW_STOCK_THRESHOLD,
  type OrderStatus,
  type ProductWithRelations,
} from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { cn, formatDate, money, shortMoney } from '../lib/format';
import { Header } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Badge, Card, Field, Input } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState, LoadingState } from '../components/ui/States';
import { ProductFormModal } from '../components/seller/ProductFormModal';
import { SellerProfileForm } from '../components/seller/SellerProfileForm';

type Tab = 'overview' | 'orders' | 'products' | 'profile';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Umumiy' },
  { id: 'orders', label: 'Buyurtmalar' },
  { id: 'products', label: 'Mahsulotlar' },
  { id: 'profile', label: 'Profil' },
];

const TONE: Record<OrderStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  new: 'accent',
  accepted: 'accent',
  installing: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

/** Reja 27: information-dense, lekin tartibli; primary metrics birinchi qatlamda */
function Metric({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <Card className="p-4">
      <p className="t-caption mb-1">{label}</p>
      <p className={cn('t-price text-xl', tone === 'accent' && 'text-accent-soft')}>{value}</p>
    </Card>
  );
}

function ProductRow({
  product,
  onEdit,
}: {
  product: ProductWithRelations;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => api.deleteSellerProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
    },
  });

  const restore = useMutation({
    mutationFn: () => api.restoreSellerProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
    },
  });

  return (
    <Card className={cn('p-4', !product.is_active && 'opacity-60')}>
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
          {product.image_url && (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="t-caption">
            {product.category?.name} · {product.compatibility.length > 0 ? `${product.compatibility.length} ta model` : 'Universal'}
          </p>
        </div>
        <div className="text-right">
          <p className="t-price text-base">{money(product.price)}</p>
          <p
            className={cn(
              'text-xs',
              product.stock <= LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-text-subtle'
            )}
          >
            {product.stock} dona
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        {!product.is_active && (
          <Badge tone="neutral" icon="alert">
            Faol emas
          </Badge>
        )}
        <div className="ml-auto flex gap-2">
          {product.is_active ? (
            <>
              <Button size="sm" variant="secondary" onClick={onEdit}>
                <Icon name="sliders" size={14} />
                Tahrirlash
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() => {
                  if (confirm(`"${product.name}" o'chirilsinmi?`)) remove.mutate();
                }}
              >
                <Icon name="trash" size={14} />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" loading={restore.isPending} onClick={() => restore.mutate()}>
              <Icon name="refresh" size={14} />
              Tiklash
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SellerPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [businessName, setBusinessName] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | 'new' | null>(null);
  const queryClient = useQueryClient();

  const stats = useQuery({ queryKey: ['seller-stats'], queryFn: api.sellerStats, retry: false });
  const profile = useQuery({
    queryKey: ['seller-profile'],
    queryFn: api.sellerProfile,
    enabled: !stats.isError && tab === 'profile',
  });
  const orders = useQuery({
    queryKey: ['seller-orders'],
    queryFn: api.sellerOrders,
    enabled: !stats.isError,
  });
  const products = useQuery({
    queryKey: ['seller-products'],
    queryFn: api.sellerProducts,
    enabled: !stats.isError,
  });

  const register = useMutation({
    mutationFn: () => {
      // Yangi tizimda seller ro'yxatdan o'tish paytida yaratiladi.
      // Bu eski Telegram flow uchun edi — hozir ishlatilmaydi.
      return Promise.reject(new Error('Bu funksiya ishlamaydi. Qaytadan ro\'yxatdan o\'ting.'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (err) => setRegisterError(err instanceof ApiRequestError ? err.message : 'Ochilmadi'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
    },
  });

  if (stats.isLoading) {
    return (
      <>
        <Header title="Sotuvchi kabineti" back />
        <LoadingState />
      </>
    );
  }

  if (stats.isError) {
    return (
      <>
        <Header title="Sotuvchi kabineti" back />
        <div className="px-4 pt-6">
          <EmptyState
            icon="store"
            title="Sotuvchi profili yo‘q"
            description="Mahsulot qo‘shish va buyurtmalarni boshqarish uchun biznes profilini oching."
          />
          <div className="mx-auto max-w-sm space-y-4">
            <Field label="Biznes nomi">
              <Input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Masalan: Sardor Tuning Garage"
              />
            </Field>
            {registerError && (
              <p className="flex items-start gap-1.5 text-sm text-danger">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                {registerError}
              </p>
            )}
            <Button
              fullWidth
              size="lg"
              disabled={businessName.trim().length < 2}
              loading={register.isPending}
              onClick={() => register.mutate()}
            >
              Sotuvchi profilini ochish
            </Button>
          </div>
        </div>
      </>
    );
  }

  const s = stats.data!.stats;

  return (
    <>
      <Header title="Sotuvchi kabineti" back />

      <div className="px-4 pt-4">
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex-1 shrink-0 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === item.id ? 'bg-surface-2 text-text' : 'text-text-muted'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Yangi buyurtma" value={String(s.new_orders_count)} tone="accent" />
              <Metric label="Jami buyurtma" value={String(s.orders_count)} />
              <Metric label="Mahsulotlar" value={String(s.products_count)} />
              <Metric label="Tushum" value={shortMoney(s.revenue)} />
            </div>

            <Card
              className="flex cursor-pointer items-center justify-between border-accent/30 bg-accent/8 p-4 transition-colors active:bg-accent/12"
              onClick={() => navigate('/seller/credits')}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
                  <Icon name="sparkles" size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium">AI kredit balansi</p>
                  <p className="t-caption">{s.credits} kredit qoldi</p>
                </div>
              </div>
              <Icon name="chevron-right" size={18} className="text-text-subtle" />
            </Card>

            {s.low_stock_count > 0 && (
              <Card className="flex items-start gap-3 border-warning/30 bg-warning/8 p-4">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-medium">Ombor tugayapti</p>
                  <p className="t-caption">
                    {s.low_stock_count} ta mahsulotda {LOW_STOCK_THRESHOLD} donadan kam qoldi.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.isLoading ? (
              <LoadingState />
            ) : orders.data?.orders.length ? (
              orders.data.orders.map((order) => {
                const next = ORDER_STATUS_FLOW[order.status] as readonly OrderStatus[];
                return (
                  <Card key={order.id} className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          #{order.id.slice(0, 8)}
                        </p>
                        <p className="t-caption">{formatDate(order.created_at)}</p>
                      </div>
                      <Badge tone={TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </div>

                    <ul className="space-y-1.5 border-t border-border pt-3">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between gap-4 text-sm">
                          <span className="min-w-0 flex-1 truncate text-text-muted">
                            {item.product_name} × {item.quantity}
                          </span>
                          <span className="tabular-nums">
                            {money(item.price * item.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
                      <span className="t-caption">{order.phone ?? '—'}</span>
                      <span className="t-price">{money(order.total)}</span>
                    </div>

                    {order.note && <p className="t-caption mt-2">Izoh: {order.note}</p>}

                    {next.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {next.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={status === 'cancelled' ? 'danger' : 'primary'}
                            loading={updateStatus.isPending}
                            onClick={() => {
                              if (
                                status === 'cancelled' &&
                                !confirm('Bu buyurtmani bekor qilishga ishonchingiz komilmi?')
                              ) {
                                return;
                              }
                              updateStatus.mutate({ id: order.id, status });
                            }}
                          >
                            {ORDER_STATUS_LABELS[status]}
                          </Button>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon="package"
                title="Buyurtmalar yo‘q"
                description="Yangi buyurtma kelganda shu yerda ko‘rinadi."
              />
            )}
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-3">
            <Button fullWidth onClick={() => setEditingProduct('new')}>
              <Icon name="plus" size={16} />
              Yangi mahsulot
            </Button>

            {products.isLoading ? (
              <LoadingState />
            ) : products.data?.products.length ? (
              products.data.products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  onEdit={() => setEditingProduct(product)}
                />
              ))
            ) : (
              <EmptyState
                icon="package"
                title="Mahsulot yo‘q"
                description="Katalogga birinchi mahsulotni qo‘shing."
              />
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div className="space-y-3">
            {profile.isLoading || !profile.data ? (
              <LoadingState />
            ) : (
              <SellerProfileForm seller={profile.data.seller} />
            )}
          </div>
        )}
      </div>

      {editingProduct && (
        <ProductFormModal
          product={editingProduct === 'new' ? undefined : editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </>
  );
}

import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@carvision/shared';
import { api } from '../lib/api';
import { formatDate, money } from '../lib/format';
import { Header } from '../components/AppShell';
import { Badge, Card } from '../components/ui/Primitives';
import { EmptyState, LoadingState } from '../components/ui/States';

const TONE: Record<OrderStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  new: 'accent',
  accepted: 'accent',
  installing: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export function OrdersPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: api.orders });

  if (isLoading) {
    return (
      <>
        <Header title="Buyurtmalarim" back />
        <LoadingState />
      </>
    );
  }

  const orders = data?.orders ?? [];

  if (orders.length === 0) {
    return (
      <>
        <Header title="Buyurtmalarim" back />
        <EmptyState
          icon="package"
          title="Buyurtmalar yo‘q"
          description="Konfiguratsiyangizga mos mahsulotni tanlab, birinchi buyurtmani bering."
          action={{ label: 'Katalogga o‘tish', onClick: () => navigate('/market') }}
        />
      </>
    );
  }

  return (
    <>
      <Header title="Buyurtmalarim" back />

      <div className="space-y-3 px-4 pt-4">
        {orders.map((order) => (
          <Card key={order.id} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {order.seller?.business_name ?? 'Sotuvchi'}
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
                  <span className="tabular-nums">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="t-caption">Jami</span>
              <span className="t-price">{money(order.total)}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

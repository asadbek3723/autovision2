import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '../lib/api';
import { money } from '../lib/format';
import { notifyHaptic as notify } from '../lib/haptics';
import { Header } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Card, Field, Input, Textarea } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/States';

/** Reja 14: MVP'da real to'lov yo'q — order yaratilishi va sellerga yetib borishi yetarli */
export function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const cart = useQuery({ queryKey: ['cart'], queryFn: api.cart });

  useEffect(() => {
    if (me.data?.user.phone && !phone) setPhone(me.data.user.phone);
  }, [me.data, phone]);

  const createOrder = useMutation({
    mutationFn: () => api.createOrder({ phone: phone.trim(), note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      notify('success');
      setDone(true);
    },
    onError: (err) => {
      notify('error');
      setError(err instanceof ApiRequestError ? err.message : 'Buyurtma yaratilmadi');
    },
  });

  /* Reja 30: success state natijani va keyingi eng foydali qadamni ko'rsatadi */
  if (done) {
    return (
      <>
        <Header title="Buyurtma" />
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
            <Icon name="check" size={28} />
          </div>
          <h1 className="t-h1 mb-2">Buyurtma qabul qilindi</h1>
          <p className="t-caption max-w-xs">
            Sotuvchi ko‘rsatilgan raqam orqali siz bilan bog‘lanadi va o‘rnatish vaqtini
            kelishadi.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Button fullWidth onClick={() => navigate('/orders')}>
              Buyurtmalarim
            </Button>
            <Button variant="secondary" fullWidth onClick={() => navigate('/market')}>
              Katalogga qaytish
            </Button>
          </div>
        </div>
      </>
    );
  }

  const items = cart.data?.cart.items ?? [];

  if (!cart.isLoading && items.length === 0) {
    return (
      <>
        <Header title="Buyurtma" back />
        <EmptyState
          icon="cart"
          title="Savat bo‘sh"
          description="Buyurtma berish uchun avval mahsulot tanlang."
          action={{ label: 'Katalogga o‘tish', onClick: () => navigate('/market') }}
        />
      </>
    );
  }

  const phoneValid = /^\+?\d{9,15}$/.test(phone.replace(/[\s()-]/g, ''));

  return (
    <>
      <Header title="Buyurtma" back />

      <div className="space-y-6 px-4 pt-4">
        <Card className="p-4">
          <h2 className="t-h2 mb-3">Buyurtma tarkibi</h2>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0 flex-1 truncate text-text-muted">
                  {item.product?.name} × {item.quantity}
                </span>
                <span className="tabular-nums">
                  {money((item.product?.price ?? 0) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
            <span className="t-caption">Jami</span>
            <span className="t-price text-xl">{money(cart.data?.cart.total ?? 0)}</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Field
            label="Telefon raqam"
            hint="Sotuvchi shu raqam orqali bog‘lanadi."
            error={phone && !phoneValid ? 'Raqamni to‘liq kiriting' : undefined}
          >
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+998 90 123 45 67"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>

          <Field label="Izoh" hint="Ixtiyoriy — o‘rnatish vaqti yoki manzil.">
            <Textarea
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Masalan: shanba kuni ertalab qulay"
            />
          </Field>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <Icon name="alert" size={16} />
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-20 z-20 mt-6 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Button
          fullWidth
          size="lg"
          disabled={!phoneValid}
          loading={createOrder.isPending}
          onClick={() => {
            setError(null);
            createOrder.mutate();
          }}
        >
          Buyurtmani tasdiqlash
        </Button>
      </div>
    </>
  );
}

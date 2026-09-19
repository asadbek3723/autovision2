import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { Header } from '../components/AppShell';
import { ProductImage } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState, LoadingState } from '../components/ui/States';

export function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['cart'], queryFn: api.cart });

  const setQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.setCartQuantity(itemId, quantity),
    onSuccess: ({ cart }) => queryClient.setQueryData(['cart'], { cart }),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api.removeCartItem(itemId),
    onSuccess: ({ cart }) => queryClient.setQueryData(['cart'], { cart }),
  });

  if (isLoading) {
    return (
      <>
        <Header title="Savat" />
        <LoadingState />
      </>
    );
  }

  const cart = data?.cart;

  if (!cart || cart.items.length === 0) {
    return (
      <>
        <Header title="Savat" />
        <EmptyState
          icon="cart"
          title="Savat bo‘sh"
          description="Konfiguratsiyangizga mos mahsulotlarni tanlang."
          action={{ label: 'Katalogga o‘tish', onClick: () => navigate('/market') }}
        />
      </>
    );
  }

  return (
    <>
      <Header title="Savat" />

      <div className="px-4 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8 lg:px-0 lg:pt-6">
        <div className="space-y-3">
        {cart.items.map((item) => {
          const product = item.product;
          if (!product) return null;

          return (
            <Card key={item.id} className="flex gap-4 p-4">
              <div className="w-20 shrink-0">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  className="aspect-square"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <p className="line-clamp-2 text-sm font-medium">{product.name}</p>
                <p className="t-price mt-1 text-base">{money(product.price)}</p>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      aria-label="Kamaytirish"
                      className="flex h-9 w-9 items-center justify-center text-text-muted active:bg-surface-2"
                      onClick={() =>
                        setQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })
                      }
                    >
                      <Icon name="minus" size={16} />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Ko‘paytirish"
                      disabled={item.quantity >= product.stock}
                      className="flex h-9 w-9 items-center justify-center text-text-muted active:bg-surface-2 disabled:opacity-40"
                      onClick={() =>
                        setQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })
                      }
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    aria-label="O‘chirish"
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-text-subtle transition-colors hover:text-danger"
                    onClick={() => remove.mutate(item.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        </div>

        <Card className="mt-3 p-4 lg:sticky lg:top-24 lg:mt-0 lg:p-6">
          <div className="flex items-baseline justify-between">
            <span className="t-caption">Jami</span>
            <span className="t-price text-xl lg:text-2xl">{money(cart.total)}</span>
          </div>
          <p className="t-caption mt-2">
            To‘lov ilova ichida amalga oshirilmaydi — sotuvchi siz bilan bog‘lanadi.
          </p>
          {/* Desktop: tugma xulosa kartasi ichida (mobilda pastdagi sticky panel ishlatiladi) */}
          <div className="mt-5 hidden lg:block">
            <Button fullWidth size="lg" onClick={() => navigate('/checkout')}>
              Buyurtma berish
              <Icon name="arrow-right" size={18} />
            </Button>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-20 z-20 mt-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <Button fullWidth size="lg" onClick={() => navigate('/checkout')}>
          Buyurtma berish
          <Icon name="arrow-right" size={18} />
        </Button>
      </div>
    </>
  );
}

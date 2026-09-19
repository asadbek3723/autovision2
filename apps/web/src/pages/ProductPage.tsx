import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { money } from '../lib/format';
import { notifyHaptic as notify } from '../lib/haptics';
import { useStudio } from '../store/useStudio';
import { Header } from '../components/AppShell';
import { ProductImage } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { Badge, Card } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { ErrorState, LoadingState } from '../components/ui/States';

/** Reja 13 va 26: moslik, sotuvchi, stock va o'rnatish xizmati yashirilmaydi */
export function ProductPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { vehicleModelId } = useStudio();
  const [added, setAdded] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.product(id),
  });

  const addToCart = useMutation({
    mutationFn: () => api.addToCart(id, 1),
    onSuccess: ({ cart }) => {
      queryClient.setQueryData(['cart'], { cart });
      notify('success');
      setAdded(true);
    },
    onError: () => notify('error'),
  });

  if (isLoading) {
    return (
      <>
        <Header title="Mahsulot" back />
        <LoadingState />
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <Header title="Mahsulot" back />
        <ErrorState
          title="Mahsulot yuklanmadi"
          description="Ulanishni tekshirib, qaytadan urinib ko‘ring."
          onRetry={() => refetch()}
        />
      </>
    );
  }

  const product = data.product;
  const fits = vehicleModelId && product.compatibility.some((m) => m.id === vehicleModelId);
  const outOfStock = product.stock < 1;

  return (
    <>
      <Header title="Mahsulot" back />

      <div className="px-4 pt-4 pb-4 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:px-0 lg:pt-6">
        <div className="lg:sticky lg:top-24">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            className="aspect-square lg:rounded-2xl lg:border lg:border-border"
          />
        </div>

        <div>
        <div className="mt-5 lg:mt-0">
          {product.brand && <p className="t-caption mb-1">{product.brand}</p>}
          <h1 className="t-h1 mb-3 lg:text-[34px] lg:leading-tight">{product.name}</h1>
          <p className="t-price mb-4 text-xl lg:text-[28px]">{money(product.price)}</p>

          <div className="flex flex-wrap gap-1.5">
            {fits && (
              <Badge tone="success" icon="check">
                Sizning mashinangizga mos
              </Badge>
            )}
            {outOfStock ? (
              <Badge tone="warning">Omborda tugagan</Badge>
            ) : (
              <Badge>Omborda: {product.stock} dona</Badge>
            )}
            {product.installation_available && (
              <Badge tone="accent" icon="shield">
                O‘rnatish xizmati bor
              </Badge>
            )}
          </div>
        </div>

        {product.description && (
          <p className="t-body mt-6 text-text-muted">{product.description}</p>
        )}

        {/* ------------------------------------------------ compatibility */}
        <Card className="mt-6 p-4">
          <h2 className="t-h2 mb-3">Mos avtomobil modellari</h2>
          {product.compatibility.length > 0 ? (
            <ul className="space-y-2">
              {product.compatibility.map((model) => (
                <li key={model.id} className="flex items-center gap-2 text-sm">
                  <Icon name="car" size={16} className="text-text-subtle" />
                  <span>
                    {model.brand} {model.model}
                  </span>
                  {(model.year_from || model.year_to) && (
                    <span className="text-text-subtle">
                      {model.year_from ?? ''}–{model.year_to ?? ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-caption">Moslik ma’lumoti ko‘rsatilmagan.</p>
          )}
        </Card>

        {/* -------------------------------------------------- installation */}
        {product.installation_available && (
          <Card className="mt-4 p-4">
            <h2 className="t-h2 mb-1">O‘rnatish xizmati</h2>
            <p className="t-caption">
              {product.installation_price
                ? `Sotuvchi o‘rnatishni ${money(product.installation_price)} ga bajaradi.`
                : 'O‘rnatish narxga kiritilgan.'}
            </p>
          </Card>
        )}

        {/* --------------------------------------------------------- seller */}
        {product.seller && (
          <Card className="mt-4 p-4">
            <h2 className="t-h2 mb-2">Sotuvchi</h2>
            <div className="flex items-center gap-2">
              <Icon name="store" size={18} className="text-text-subtle" />
              <span className="font-medium">{product.seller.business_name}</span>
              {product.seller.verified && (
                <Badge tone="success" icon="shield">
                  Tasdiqlangan
                </Badge>
              )}
            </div>
            {product.seller.phone && (
              <p className="t-caption mt-2">{product.seller.phone}</p>
            )}
          </Card>
        )}

      {/* Reja 24 (Fitts's Law): asosiy CTA doim qo'l ostida (desktopda — kontent ichida) */}
      <div className="sticky bottom-20 z-20 -mx-4 mt-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        {added ? (
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setAdded(false)}>
              Davom etish
            </Button>
            <Button fullWidth onClick={() => navigate('/cart')}>
              Savatga o‘tish
              <Icon name="arrow-right" size={16} />
            </Button>
          </div>
        ) : (
          <Button
            fullWidth
            size="lg"
            disabled={outOfStock}
            loading={addToCart.isPending}
            onClick={() => addToCart.mutate()}
          >
            <Icon name="cart" size={18} />
            {outOfStock ? 'Omborda mavjud emas' : 'Savatga qo‘shish'}
          </Button>
        )}
      </div>
        </div>
      </div>
    </>
  );
}

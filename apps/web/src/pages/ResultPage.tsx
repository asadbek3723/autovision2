import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CATEGORY_LABELS, describeOptions } from '@carvision/shared';
import { api } from '../lib/api';
import { useStudio } from '../store/useStudio';
import { Header } from '../components/AppShell';
import { CompareSlider } from '../components/CompareSlider';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { Badge, Card } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState, Skeleton } from '../components/ui/States';

/**
 * Reja 25.7–25.8: taqqoslash + natijadan keyingi asosiy CTA —
 * mos real mahsulotlarni ko'rish.
 */
export function ResultPage() {
  const navigate = useNavigate();
  const { generation, car, vehicleModelId, options } = useStudio();

  const categories = generation?.categories ?? [];

  const products = useQuery({
    queryKey: ['products', categories, vehicleModelId],
    queryFn: () =>
      api.products({
        categories,
        vehicle_model_id: vehicleModelId ?? undefined,
        limit: 6,
      }),
    enabled: categories.length > 0,
  });

  if (!generation || !car) {
    return (
      <>
        <Header title="Natija" back />
        <EmptyState
          icon="wand"
          title="Hali konfiguratsiya yo‘q"
          description="Avtomobil rasmini yuklab, o‘zgarishlarni tanlang."
          action={{ label: 'Studioga o‘tish', onClick: () => navigate('/') }}
        />
      </>
    );
  }

  const selections = describeOptions(generation.options ?? options);

  return (
    <>
      <Header title="Natija" back />

      <div className="px-4 pt-4">
        {generation.generated_image ? (
          <CompareSlider before={generation.original_image} after={generation.generated_image} />
        ) : (
          <Skeleton className="aspect-[4/3] w-full" />
        )}

        {selections.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {selections.map((text) => (
              <Badge key={text} tone="accent">
                {text}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
            <Icon name="sliders" size={16} />
            O‘zgartirish
          </Button>
          <Button
            fullWidth
            onClick={() =>
              navigate(`/market?categories=${categories.join(',')}`)
            }
          >
            Mahsulotlar
            <Icon name="arrow-right" size={16} />
          </Button>
        </div>

        {/* Reja 26: AI konfiguratsiyasidan marketplacega o'tish uzluksiz */}
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="t-h2">Shu konfiguratsiya uchun</h2>
            <Link to={`/market?categories=${categories.join(',')}`} className="text-sm text-accent-soft">
              Barchasi
            </Link>
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {categories.map((slug) => (
              <Badge key={slug}>{CATEGORY_LABELS[slug] ?? slug}</Badge>
            ))}
          </div>

          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : products.data?.products.length ? (
            <div className="grid grid-cols-2 gap-3">
              {products.data.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  vehicleModelId={vehicleModelId}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6">
              <p className="t-caption text-center">
                Bu konfiguratsiya uchun hozircha mahsulot yo‘q. Butun katalogni ko‘rib chiqing.
              </p>
              <Button
                variant="secondary"
                fullWidth
                className="mt-4"
                onClick={() => navigate('/market')}
              >
                Katalogga o‘tish
              </Button>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

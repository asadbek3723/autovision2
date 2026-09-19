import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useStudio } from '../store/useStudio';
import { Header } from '../components/AppShell';
import { ProductGrid } from '../components/ProductCard';
import { Chip, Input } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/States';

/**
 * Reja 26: search va category navigation sodda; filterlar progressive
 * disclosure asosida; compatibility birinchi darajadagi information.
 */
export function MarketplacePage() {
  const [params, setParams] = useSearchParams();
  const { vehicleModelId } = useStudio();

  const [search, setSearch] = useState('');
  const [onlyCompatible, setOnlyCompatible] = useState(Boolean(vehicleModelId));

  const selected = (params.get('categories') ?? '').split(',').filter(Boolean);

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  const products = useQuery({
    queryKey: ['products', selected, search, onlyCompatible, vehicleModelId],
    queryFn: () =>
      api.products({
        categories: selected,
        search: search.trim() || undefined,
        vehicle_model_id: onlyCompatible ? (vehicleModelId ?? undefined) : undefined,
        limit: 60,
      }),
  });

  const toggleCategory = (slug: string) => {
    const next = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : [...selected, slug];
    if (next.length > 0) setParams({ categories: next.join(',') });
    else setParams({});
  };

  return (
    <>
      <Header title="Katalog" />

      <div className="px-4 pt-4 lg:px-0">
        <div className="relative lg:max-w-xl">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-subtle"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mahsulot qidirish"
            className="pl-11"
            inputMode="search"
          />
        </div>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:mt-5 lg:flex-wrap lg:overflow-visible lg:px-0">
          {vehicleModelId && (
            <Chip selected={onlyCompatible} onClick={() => setOnlyCompatible((v) => !v)}>
              Mening mashinamga mos
            </Chip>
          )}
          {categories.data?.categories.map((category) => (
            <Chip
              key={category.id}
              selected={selected.includes(category.slug)}
              onClick={() => toggleCategory(category.slug)}
            >
              {category.name}
            </Chip>
          ))}
        </div>

        <div className="mt-6 lg:mt-8">
          {products.isLoading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : products.isError ? (
            <ErrorState onRetry={() => products.refetch()} />
          ) : products.data?.products.length ? (
            <ProductGrid
              products={products.data.products}
              vehicleModelId={onlyCompatible ? vehicleModelId : null}
            />
          ) : (
            <EmptyState
              icon="search"
              title="Mahsulot topilmadi"
              description="Qidiruv so‘zini qisqartiring yoki tanlangan filtrlarni olib tashlang."
              action={
                selected.length > 0 || search || onlyCompatible
                  ? {
                      label: 'Filtrlarni tozalash',
                      onClick: () => {
                        setParams({});
                        setSearch('');
                        setOnlyCompatible(false);
                      },
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

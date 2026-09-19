import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  angleLabel,
  findGroup,
  isProductOption,
  productIdsFromOptions,
  type Generation,
} from '@carvision/shared';
import { api, ApiRequestError } from '../lib/api';
import { cn, money } from '../lib/format';
import { notifyHaptic as notify } from '../lib/haptics';
import { useStudio } from '../store/useStudio';
import { Header } from '../components/AppShell';
import { CompareSlider } from '../components/CompareSlider';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { Badge, Card } from '../components/ui/Primitives';
import { Icon } from '../components/ui/Icon';
import { EmptyState, Skeleton, Spinner } from '../components/ui/States';

/**
 * Natija: foydalanuvchining har bir rasmi (rakursi) uchun before/after va pastda
 * AYNAN u tanlagan mahsulotlar. Boshqa rakurs hali generatsiya qilinmagan bo'lsa,
 * shu yerning o'zida bitta tugma bilan qilinadi.
 */
export function ResultPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { generation, results, car, vehicleModelId, options, freeText, setGeneration } = useStudio();

  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const productIds = productIdsFromOptions(generation?.options ?? options);

  const selectedProducts = useQuery({
    queryKey: ['products', 'selected', productIds],
    queryFn: () => api.products({ ids: productIds }),
    enabled: productIds.length > 0,
  });

  const generateFor = useMutation({
    mutationFn: (photoUrl: string) =>
      api.generate({
        car_id: car!.id,
        photo_url: photoUrl,
        options: generation?.options ?? options,
        free_text: freeText.trim() || undefined,
      }),
    onSuccess: ({ generation: next }) => {
      setGeneration(next);
      setActivePhoto(next.original_image);
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      notify('success');
    },
    onError: (error) => {
      notify('error');
      setGenError(
        error instanceof ApiRequestError
          ? error.message
          : 'AI generatsiya bajarilmadi. Qaytadan urinib ko‘ring.'
      );
    },
  });

  const addAll = useMutation({
    mutationFn: async () => {
      for (const id of productIds) await api.addToCart(id, 1);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      notify('success');
      navigate('/cart');
    },
    onError: () => notify('error'),
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

  /* ---------------------------------------------------------- kadrlar */
  const photos = car.photos?.length
    ? car.photos.map((p) => ({ url: p.image_url, label: angleLabel(p.angle) }))
    : [{ url: generation.original_image, label: 'Asosiy' }];
  const active = activePhoto ?? generation.original_image;
  const activeResult: Generation | undefined =
    results[active] ?? (generation.original_image === active ? generation : undefined);
  const hasResult = Boolean(activeResult?.generated_image);
  const busy = generateFor.isPending;

  /* ---------------------------------------------------------- tanlov */
  const applied = generation.options ?? options;
  const badges: string[] = [];
  for (const [key, value] of Object.entries(applied)) {
    if (isProductOption(value)) {
      const product = selectedProducts.data?.products.find((p) => p.id === value);
      if (product) badges.push(product.name);
    } else {
      const option = findGroup(key)?.options.find((o) => o.value === value);
      if (option) badges.push(`${findGroup(key)?.label}: ${option.label}`);
    }
  }
  const total = (selectedProducts.data?.products ?? []).reduce((sum, p) => sum + p.price, 0);

  return (
    <>
      <Header title="Natija" back />

      <div className="px-4 pt-4 lg:px-0 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div>
            {/* ------------------------------------------- before / after */}
            {hasResult ? (
              <CompareSlider
                key={active}
                before={activeResult!.original_image}
                after={activeResult!.generated_image!}
                beforeLabel="Oldin"
                afterLabel="Keyin"
              />
            ) : (
              <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2">
                <img src={active} alt="Asl rasm" className="block w-full opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/40 p-6 text-center backdrop-blur-[2px]">
                  {busy ? (
                    <>
                      <Spinner size={26} />
                      <p className="text-sm font-medium">AI ishlamoqda… (20–40 soniya)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-text-muted">
                        Bu rakurs uchun natija hali yaratilmagan
                      </p>
                      <Button onClick={() => { setGenError(null); generateFor.mutate(active); }}>
                        <Icon name="wand" size={16} />
                        Shu rasmda ko‘rish
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {genError && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-danger">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                {genError}
              </p>
            )}

            {/* --------------------------------- foydalanuvchining barcha rasmlari */}
            {photos.length > 1 && (
              <div className="mt-4">
                <p className="t-caption mb-2">Rasmlaringiz — bosib oldin/keyinni ko‘ring</p>
                <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
                  {photos.map((photo) => {
                    const done = Boolean(results[photo.url]?.generated_image);
                    return (
                      <button
                        key={photo.url}
                        type="button"
                        onClick={() => setActivePhoto(photo.url)}
                        aria-pressed={photo.url === active}
                        aria-label={photo.label}
                        className={cn(
                          'relative h-16 w-24 shrink-0 overflow-hidden rounded-md border transition-colors',
                          photo.url === active ? 'border-accent' : 'border-border hover:border-border-strong'
                        )}
                      >
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                        <span
                          className={cn(
                            'absolute right-1 bottom-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium backdrop-blur',
                            done ? 'bg-success/80 text-white' : 'bg-bg/80 text-text-muted'
                          )}
                        >
                          {done ? 'Tayyor' : photo.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 lg:sticky lg:top-24 lg:mt-0 lg:rounded-2xl lg:border lg:border-border lg:bg-surface/60 lg:p-6">
            <h2 className="t-h2 hidden lg:mb-4 lg:block lg:text-[20px]">Tanlangan o‘zgarishlar</h2>

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {badges.map((text) => (
                  <Badge key={text} tone="accent">
                    {text}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-3 lg:mt-8 lg:flex-col">
              <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
                <Icon name="sliders" size={16} />
                O‘zgartirish
              </Button>
              {productIds.length > 0 && (
                <Button fullWidth loading={addAll.isPending} onClick={() => addAll.mutate()}>
                  <Icon name="cart" size={16} />
                  Hammasini savatga
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ------------------------- aynan foydalanuvchi tanlagan mahsulotlar */}
        <section className="mt-10 lg:mt-16">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="t-h2">Siz tanlagan mahsulotlar</h2>
            {total > 0 && <span className="t-price text-base">{money(total)}</span>}
          </div>

          {productIds.length === 0 ? (
            <Card className="p-6">
              <p className="t-caption text-center">
                Bu safar faqat rang tanladingiz — sotib olinadigan mahsulot yo‘q. Studioda far, disk
                yoki panjara ham tanlab ko‘ring.
              </p>
              <Button variant="secondary" fullWidth className="mt-4" onClick={() => navigate('/')}>
                Studioga qaytish
              </Button>
            </Card>
          ) : selectedProducts.isLoading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {productIds.map((id) => (
                <Skeleton key={id} className="h-56" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
              {selectedProducts.data?.products.map((product) => (
                <ProductCard key={product.id} product={product} vehicleModelId={vehicleModelId} />
              ))}
            </div>
          )}

          <p className="t-caption mt-6">
            Boshqa qismlar kerakmi?{' '}
            <Link to="/market" className="text-accent-soft">
              Katalogni ko‘rish
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}

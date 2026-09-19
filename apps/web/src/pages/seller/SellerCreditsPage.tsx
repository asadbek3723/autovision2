import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CREDIT_PACKAGES } from '@carvision/shared';
import { api, ApiRequestError } from '../../lib/api';
import { resizeImage } from '../../lib/imageResize';
import { cn, formatDate } from '../../lib/format';
import { Header } from '../../components/AppShell';
import { Card, Textarea } from '../../components/ui/Primitives';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { LoadingState, Spinner } from '../../components/ui/States';

/**
 * "Subscribe" sahifasi — sotuvchi o'z mahsulotlarini AI bilan namoyish
 * qilish uchun kredit sotib oladi (100 rasm = $20). Hozircha to'lov mock:
 * sotib olish darhol tasdiqlanadi, real Payme/Click keyinroq ulanadi.
 */
export function SellerCreditsPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const credits = useQuery({ queryKey: ['seller-credits'], queryFn: api.sellerCredits });
  const products = useQuery({ queryKey: ['seller-products'], queryFn: api.sellerProducts });
  const generations = useQuery({ queryKey: ['seller-generations'], queryFn: api.sellerGenerations });

  const purchase = useMutation({
    mutationFn: (packageId: string) => api.purchaseCredits(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-credits'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const resized = await resizeImage(file!);
      return api.sellerGenerate(resized, prompt.trim(), productId || undefined);
    },
    onSuccess: ({ generation }) => {
      setResult(generation.result_image);
      queryClient.invalidateQueries({ queryKey: ['seller-credits'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
      queryClient.invalidateQueries({ queryKey: ['seller-generations'] });
      queryClient.invalidateQueries({ queryKey: ['seller-products'] });
    },
    onError: (err) => setGenError(err instanceof ApiRequestError ? err.message : 'Generatsiya bajarilmadi'),
  });

  const balance = credits.data?.credits ?? 0;
  const canGenerate = Boolean(file) && prompt.trim().length > 0 && balance > 0;

  return (
    <>
      <Header title="AI kredit" back />

      <div className="space-y-6 px-4 pt-4">
        <Card className="flex items-center justify-between border-accent/30 bg-accent/8 p-5">
          <div>
            <p className="t-caption mb-1">Joriy balans</p>
            {credits.isLoading ? (
              <Spinner size={18} />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{balance} kredit</p>
            )}
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent-soft">
            <Icon name="sparkles" size={22} />
          </span>
        </Card>

        <section>
          <h2 className="t-h2 mb-3">Kredit sotib olish</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.id} className="flex flex-col p-4">
                <p className="t-caption mb-1">{pkg.label}</p>
                <p className="mb-1 text-xl font-semibold">{pkg.credits} rasm</p>
                <p className="t-caption mb-4">${pkg.priceUsd} · rasmiga ${(pkg.priceUsd / pkg.credits).toFixed(2)}</p>
                <Button
                  fullWidth
                  size="sm"
                  variant="secondary"
                  className="mt-auto"
                  loading={purchase.isPending}
                  onClick={() => purchase.mutate(pkg.id)}
                >
                  Sotib olish
                </Button>
              </Card>
            ))}
          </div>
          <p className="t-caption mt-3">
            To'lov hozircha mock rejimda — sotib olish darhol tasdiqlanadi. Real to'lov (Payme/Click) keyinroq ulanadi.
          </p>
        </section>

        <section>
          <h2 className="t-h2 mb-3">AI bilan mahsulot rasmi yaratish</h2>
          <Card className="space-y-4 p-4">
            <label
              className={cn(
                'flex h-40 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-2',
                preview && 'border-solid'
              )}
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-text-subtle">
                  <Icon name="camera" size={22} />
                  <span className="text-xs">Baza rasmni tanlang</span>
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const f = event.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setPreview(URL.createObjectURL(f));
                    setResult(null);
                  }
                  event.target.value = '';
                }}
              />
            </label>

            {products.data && products.data.products.length > 0 && (
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              >
                <option value="">Mahsulotga bog'lamasdan</option>
                {products.data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={400}
              placeholder="Masalan: shu bamperni qora sport avtomobilga o'rnatilgan holda ko'rsat"
            />

            {genError && (
              <p className="flex items-start gap-1.5 text-sm text-danger">
                <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                {genError}
              </p>
            )}

            <Button
              fullWidth
              disabled={!canGenerate}
              loading={generate.isPending}
              onClick={() => {
                setGenError(null);
                generate.mutate();
              }}
            >
              <Icon name="wand" size={16} />
              {balance > 0 ? '1 kredit sarflab yaratish' : 'Kredit yetarli emas'}
            </Button>

            {result && (
              <div>
                <p className="t-caption mb-2">Natija</p>
                <img src={result} alt="AI natija" className="w-full rounded-lg" />
              </div>
            )}
          </Card>
        </section>

        <section>
          <h2 className="t-h2 mb-3">Tarix</h2>
          {generations.isLoading ? (
            <LoadingState />
          ) : generations.data?.generations.length ? (
            <div className="space-y-2">
              {generations.data.generations.map((g) => (
                <Card key={g.id} className="flex items-center gap-3 p-3">
                  <img
                    src={g.result_image ?? g.base_image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{g.prompt}</p>
                    <p className="t-caption">{formatDate(g.created_at)}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-2 py-1 text-xs',
                      g.status === 'done' && 'bg-success/12 text-success',
                      g.status === 'failed' && 'bg-danger/12 text-danger',
                      (g.status === 'processing' || g.status === 'pending') && 'bg-surface-2 text-text-muted'
                    )}
                  >
                    {g.status === 'done' ? 'Tayyor' : g.status === 'failed' ? 'Xato' : 'Jarayonda'}
                  </span>
                </Card>
              ))}
            </div>
          ) : (
            <p className="t-caption">Hali AI generatsiya qilinmagan.</p>
          )}
        </section>
      </div>
    </>
  );
}

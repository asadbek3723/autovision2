import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductWithRelations } from '@carvision/shared';
import { api, ApiRequestError } from '../../lib/api';
import { resizeImage } from '../../lib/imageResize';
import { cn } from '../../lib/format';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Primitives';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/States';

interface FormState {
  name: string;
  description: string;
  category_id: string;
  price: string;
  stock: string;
  brand: string;
  installation_available: boolean;
  installation_price: string;
  vehicle_model_ids: string[];
}

function toFormState(product?: ProductWithRelations): FormState {
  return {
    name: product?.name ?? '',
    description: product?.description ?? '',
    category_id: product?.category?.id ?? '',
    price: product ? String(product.price) : '',
    stock: product ? String(product.stock) : '0',
    brand: product?.brand ?? '',
    installation_available: product?.installation_available ?? false,
    installation_price: product?.installation_price ? String(product.installation_price) : '',
    vehicle_model_ids: product?.compatibility.map((v) => v.id) ?? [],
  };
}

export function ProductFormModal({
  product,
  onClose,
}: {
  product?: ProductWithRelations;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const vehicleModels = useQuery({ queryKey: ['vehicle-models'], queryFn: api.vehicleModels });

  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const uploadImage = useMutation({
    mutationFn: async (file: File) => api.uploadSellerProductImage(await resizeImage(file)),
    onMutate: () => setImageUploading(true),
    onSuccess: ({ image_url }) => setImageUrl(image_url),
    onSettled: () => setImageUploading(false),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id,
        price: Number(form.price),
        stock: Number(form.stock),
        brand: form.brand.trim() || null,
        image_url: imageUrl,
        installation_available: form.installation_available,
        installation_price: form.installation_available && form.installation_price
          ? Number(form.installation_price)
          : null,
        vehicle_model_ids: form.vehicle_model_ids,
      };
      return isEdit ? api.updateSellerProduct(product!.id, body) : api.createSellerProduct(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-products'] });
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'Saqlab bo\'lmadi');
    },
  });

  const canSave =
    form.name.trim().length >= 2 &&
    form.category_id &&
    Number(form.price) >= 0 &&
    Number.isInteger(Number(form.stock)) &&
    Number(form.stock) >= 0;

  return (
    <Modal title={isEdit ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} onClose={onClose}>
      <div className="space-y-4">
        {/* Field o'zi <label> bo'lgani uchun ichiga yana <label> qo'yilmaydi
            (ichma-ich label HTML'da noto'g'ri va fayl tanlash dialogini
            ikki marta ochib yuborishi mumkin) — shuning uchun oddiy div */}
        <div>
          <span className="mb-2 block text-sm font-medium text-text">Rasm</span>
          <label
            className={cn(
              'flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 transition-colors hover:border-border-strong',
              imageUrl && 'border-solid'
            )}
          >
            {imageUploading ? (
              <Spinner size={22} />
            ) : imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-text-subtle">
                <Icon name="upload" size={22} />
                <span className="text-xs">Rasm yuklash</span>
              </span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>

        <Field label="Nomi">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Masalan: Sport orqa bamper" />
        </Field>

        <Field label="Kategoriya">
          <select
            value={form.category_id}
            onChange={(e) => set('category_id', e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="">Tanlang</option>
            {categories.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Narx (so'm)">
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label="Ombordagi soni">
            <Input
              type="number"
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => set('stock', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Brend (ixtiyoriy)">
          <Input value={form.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>

        <Field label="Tavsif (ixtiyoriy)">
          <Textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={1000}
          />
        </Field>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={form.installation_available}
            onChange={(e) => set('installation_available', e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="flex-1 text-sm">O'rnatish xizmati mavjud</span>
        </label>

        {form.installation_available && (
          <Field label="O'rnatish narxi (so'm)">
            <Input
              type="number"
              min={0}
              value={form.installation_price}
              onChange={(e) => set('installation_price', e.target.value)}
            />
          </Field>
        )}

        {vehicleModels.data && vehicleModels.data.vehicle_models.length > 0 && (
          <Field label="Mos modellar (bo'sh — barcha modellarga mos)">
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-3">
              {vehicleModels.data.vehicle_models.map((model) => {
                const selected = form.vehicle_model_ids.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() =>
                      set(
                        'vehicle_model_ids',
                        selected
                          ? form.vehicle_model_ids.filter((id) => id !== model.id)
                          : [...form.vehicle_model_ids, model.id]
                      )
                    }
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      selected
                        ? 'border-accent bg-accent/10 text-text'
                        : 'border-border text-text-muted'
                    )}
                  >
                    {model.brand} {model.model}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {error && (
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <Button
          fullWidth
          size="lg"
          disabled={!canSave || imageUploading}
          loading={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
        >
          {isEdit ? 'Saqlash' : 'Qo\'shish'}
        </Button>
      </div>
    </Modal>
  );
}

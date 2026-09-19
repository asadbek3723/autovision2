import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Seller } from '@carvision/shared';
import { api, ApiRequestError } from '../../lib/api';
import { Field, Input, Textarea, Card } from '../ui/Primitives';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

export function SellerProfileForm({ seller }: { seller: Seller }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    business_name: seller.business_name,
    description: seller.description ?? '',
    phone: seller.phone ?? '',
    address: seller.address ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.updateSellerProfile({
        business_name: form.business_name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Saqlab bo\'lmadi'),
  });

  return (
    <Card className="space-y-4 p-4">
      <Field label="Biznes nomi">
        <Input
          value={form.business_name}
          onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
        />
      </Field>
      <Field label="Tavsif">
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          maxLength={1000}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Telefon">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+998901234567"
          />
        </Field>
        <Field label="Manzil">
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </Field>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <Button
        fullWidth
        disabled={form.business_name.trim().length < 2}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        {saved ? (
          <>
            <Icon name="check" size={16} />
            Saqlandi
          </>
        ) : (
          'Saqlash'
        )}
      </Button>
    </Card>
  );
}

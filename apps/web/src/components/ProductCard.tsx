import { Link } from 'react-router-dom';
import type { ProductWithRelations } from '@carvision/shared';
import { money } from '../lib/format';
import { Icon } from './ui/Icon';
import { Badge } from './ui/Primitives';

/** Rasm bo'lmaganda ham card bir xil hierarchy bilan ko'rinadi */
export function ProductImage({
  src,
  alt,
  className = 'aspect-[4/3]',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative w-full overflow-hidden rounded-md bg-[#eef0f3] ${className}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain p-2" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-subtle">
          <Icon name="package" size={28} />
        </div>
      )}
    </div>
  );
}

/**
 * Reja 23: product image birinchi; nom, moslik, narx va CTA keyingi hierarchy'da.
 * Reja 26: compatibility birinchi darajadagi information.
 */
export function ProductCard({
  product,
  vehicleModelId,
}: {
  product: ProductWithRelations;
  vehicleModelId?: string | null;
}) {
  const fits =
    vehicleModelId && product.compatibility.some((model) => model.id === vehicleModelId);
  const outOfStock = product.stock < 1;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col rounded-lg border border-border bg-surface p-3 transition-all hover:border-border-strong lg:p-4 lg:hover:-translate-y-0.5 lg:hover:shadow-[0_18px_40px_-24px_rgb(47_107_255/0.5)]"
    >
      <ProductImage src={product.image_url} alt={product.name} />

      <div className="mt-3 flex flex-1 flex-col">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{product.name}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {fits && (
            <Badge tone="success" icon="check">
              Mos keladi
            </Badge>
          )}
          {outOfStock && <Badge tone="warning">Mavjud emas</Badge>}
        </div>

        <p className="t-price mt-auto pt-3">{money(product.price)}</p>
        {product.seller && (
          <p className="mt-1 truncate text-xs text-text-subtle">{product.seller.business_name}</p>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  vehicleModelId,
}: {
  products: ProductWithRelations[];
  vehicleModelId?: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} vehicleModelId={vehicleModelId} />
      ))}
    </div>
  );
}

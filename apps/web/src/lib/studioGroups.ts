import {
  CATEGORY_LABELS,
  CUSTOMIZATION_GROUPS,
  type CategorySlug,
  type ProductWithRelations,
} from '@carvision/shared';
import type { DockGroup } from '../components/ConfiguratorDock';
import { money } from './format';

/** Konfigurator bo'limlarining tartibi: avval rang, keyin katalogdagi qismlar */
const CATEGORY_ORDER = ['headlights', 'taillights', 'wheels', 'grille', 'front-bumper', 'rear-bumper', 'spoilers'];

/**
 * Studio doki: "Rang" (aniq HEX bilan) + katalogdagi mahsulotlari bor har bir bo'lim.
 * Mahsulot bo'limlarining kaliti — kategoriya slug'i, qiymati — mahsulot id'si; AI
 * shu mahsulotning rasmini reference qilib, mijozning rasmiga o'rnatadi.
 */
export function buildDockGroups(products: ProductWithRelations[]): DockGroup[] {
  const paint = CUSTOMIZATION_GROUPS.find((group) => group.key === 'paint');
  const groups: DockGroup[] = [];

  if (paint) {
    groups.push({
      key: paint.key,
      label: paint.label,
      options: paint.options.map((option) => ({
        value: option.value,
        label: option.label,
        swatch: option.swatch,
      })),
    });
  }

  const bySlug = new Map<string, ProductWithRelations[]>();
  for (const product of products) {
    const slug = product.category?.slug;
    if (!slug || !product.image_url) continue;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), product]);
  }

  const slugs = [...bySlug.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const slug of slugs) {
    const list = bySlug.get(slug)!;
    groups.push({
      key: slug,
      label: CATEGORY_LABELS[slug as CategorySlug] ?? list[0]?.category?.name ?? slug,
      options: list.map((product) => ({
        value: product.id,
        label: product.name,
        image: product.image_url,
        caption: money(product.price),
      })),
    });
  }

  return groups;
}

/** Tanlovni qisqa matnlarga aylantiradi: "Faralar: Gentra BMW Angel Eyes…" */
export function describeSelection(options: Record<string, string>, groups: DockGroup[]): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(options)) {
    const group = groups.find((g) => g.key === key);
    const option = group?.options.find((o) => o.value === value);
    if (group && option) out.push(`${group.label}: ${option.label}`);
  }
  return out;
}

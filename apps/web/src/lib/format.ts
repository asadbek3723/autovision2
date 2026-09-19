const nf = new Intl.NumberFormat('ru-RU');

/** Narxni so'mda formatlash — reja 21: price alohida ajratiladi */
export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${nf.format(Math.round(n))} so'm`;
}

export function shortMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mln`;
  if (value >= 1_000) return `${Math.round(value / 1000)} ming`;
  return nf.format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

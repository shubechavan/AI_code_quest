/** Formatting helpers shared across the console. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const fmtCurrency = (n) => (n == null ? '—' : currency.format(n));

export const fmtNumber = (n, digits = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });

export const fmtPercent = (p, digits = 0) =>
  p == null ? '—' : `${(p * 100).toFixed(digits)}%`;

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const titleCase = (s) =>
  (s ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

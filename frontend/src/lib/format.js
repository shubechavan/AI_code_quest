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

/** Compact relative time, e.g. "3m", "5h", "2d". Falls back to a date past a week. */
export function fmtRelative(iso) {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day <= 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const titleCase = (s) =>
  (s ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

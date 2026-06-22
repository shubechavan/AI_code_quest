/**
 * Risk presentation helpers.
 *
 * Centralises the mapping from a risk band to its label and classes so the same visual
 * language is used everywhere a band appears. Backgrounds use low-opacity fills and the
 * border/text use mid-tones, so the badges read correctly on both the dark (default) and
 * light themes without per-theme overrides.
 */
export const RISK_BANDS = ['critical', 'high', 'medium', 'low'];

const STYLES = {
  critical: {
    label: 'Critical',
    text: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
    hex: '#f43f5e',
  },
  high: {
    label: 'High',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    dot: 'bg-orange-500',
    hex: '#fb923c',
  },
  medium: {
    label: 'Medium',
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    dot: 'bg-amber-400',
    hex: '#facc15',
  },
  low: {
    label: 'Low',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
    hex: '#34d399',
  },
};

export function riskStyle(band) {
  return STYLES[band] ?? STYLES.low;
}

export function bandFromScore(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function scoreHex(score) {
  return riskStyle(bandFromScore(score)).hex;
}

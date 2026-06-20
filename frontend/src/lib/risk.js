/**
 * Risk presentation helpers.
 *
 * Centralises the mapping from a risk band to its label and Tailwind classes so the same
 * visual language is used everywhere a band appears. Colours are muted (50/700 pairings)
 * to read as status indicators, not alarms.
 */
export const RISK_BANDS = ['critical', 'high', 'medium', 'low'];

const STYLES = {
  critical: { label: 'Critical', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' },
  high: { label: 'High', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'Medium', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  low: { label: 'Low', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-600' },
};

export function riskStyle(band) {
  return STYLES[band] ?? STYLES.low;
}

export function scoreColor(score) {
  if (score >= 80) return STYLES.critical.dot;
  if (score >= 60) return STYLES.high.dot;
  if (score >= 35) return STYLES.medium.dot;
  return STYLES.low.dot;
}

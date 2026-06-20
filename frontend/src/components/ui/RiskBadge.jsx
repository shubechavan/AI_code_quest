import { riskStyle } from '../../lib/risk.js';

/** Compact risk-band indicator: a coloured dot plus the band label. */
export function RiskBadge({ band, score }) {
  const s = riskStyle(band);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium
        ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
      {score != null && <span className="tnum opacity-70">· {score}</span>}
    </span>
  );
}

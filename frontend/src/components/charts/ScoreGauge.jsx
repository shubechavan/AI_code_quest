import { riskStyle } from '../../lib/risk.js';

/**
 * Composite-score gauge.
 *
 * A semicircular SVG arc — no chart library needed. The fill is a gradient toward the
 * band colour so the score reads at a glance, and the arc animates from empty on mount.
 * Track and text colours come from theme CSS variables so it works in dark and light.
 */
export function ScoreGauge({ score, band, size = 220 }) {
  const radius = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = riskStyle(band).hex;
  const label = riskStyle(band).label;
  const gradId = `gauge-${band}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 24} viewBox={`0 0 ${size} ${size / 2 + 24}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d={`M 14 ${cy} A ${radius} ${radius} 0 0 1 ${size - 14} ${cy}`}
          fill="none"
          stroke="rgb(var(--line))"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Value */}
        <path
          d={`M 14 ${cy} A ${radius} ${radius} 0 0 1 ${size - 14} ${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" className="tnum" style={{ fontSize: 40, fontWeight: 700, fill: 'rgb(var(--fg))' }}>
          {score.toFixed(0)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ fontSize: 12, fill: 'rgb(var(--faint))' }}>
          out of 100
        </text>
      </svg>
      <span className="mt-1 text-sm font-semibold" style={{ color }}>
        {label} risk
      </span>
    </div>
  );
}

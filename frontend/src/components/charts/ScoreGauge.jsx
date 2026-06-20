import { riskStyle } from '../../lib/risk.js';

/**
 * Composite-score gauge.
 *
 * A semicircular SVG arc — no chart library needed. The fill colour follows the risk band
 * so the score reads at a glance. Pure SVG keeps it crisp at any size and print-friendly.
 */
const RISK_HEX = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

export function ScoreGauge({ score, band, size = 180 }) {
  const radius = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // semicircle
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = RISK_HEX[band] ?? RISK_HEX.low;
  const label = riskStyle(band).label;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
        {/* Track */}
        <path
          d={`M 12 ${cy} A ${radius} ${radius} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value */}
        <path
          d={`M 12 ${cy} A ${radius} ${radius} 0 0 1 ${size - 12} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" className="tnum" style={{ fontSize: 30, fontWeight: 700, fill: '#171717' }}>
          {score.toFixed(0)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 11, fill: '#737373' }}>
          / 100
        </text>
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>
        {label} risk
      </span>
    </div>
  );
}

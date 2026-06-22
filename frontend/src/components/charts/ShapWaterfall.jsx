import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * SHAP attribution chart.
 *
 * A diverging horizontal bar of the strongest feature contributions for one prediction.
 * Rose bars pushed the model toward fraud, emerald bars pulled it away; bar length is the
 * exact SHAP value (model log-odds contribution). This is the literal explanation of the
 * score — not an approximation. Colours come from the theme; bars animate in on mount.
 */
const POS = '#f43f5e'; // rose-500 — increases risk
const NEG = '#34d399'; // emerald-400 — decreases risk

function ShapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-elevated">
      <div className="font-medium text-fg">{d.name}</div>
      <div className="mt-0.5 text-muted">
        Feature value: <span className="tnum text-fg">{d.featureValue}</span>
      </div>
      <div className="text-muted">
        SHAP contribution:{' '}
        <span className={`tnum font-medium ${d.value >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
          {d.value >= 0 ? '+' : ''}{d.value.toFixed(4)}
        </span>{' '}
        log-odds
      </div>
    </div>
  );
}

export function ShapWaterfall({ attributions, count = 8 }) {
  const data = [...attributions]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, count)
    .reverse()
    .map((a) => ({
      name: a.label,
      value: a.shap_value,
      featureValue: a.value,
    }));

  return (
    <div style={{ width: '100%', height: Math.max(220, data.length * 36) }}>
      <ResponsiveContainer>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 52, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: 'rgb(var(--faint))' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="rgb(var(--line))" />
          <Tooltip cursor={{ fill: 'rgb(var(--elevated))' }} content={<ShapTooltip />} />
          <Bar dataKey="value" radius={3} barSize={18} animationDuration={650}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? POS : NEG} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
              style={{ fontSize: 10, fill: 'rgb(var(--faint))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

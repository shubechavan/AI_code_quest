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
 * Red bars pushed the model toward fraud, green bars pulled it away; bar length is the
 * exact SHAP value (model log-odds contribution). This is the literal explanation of the
 * score — not an approximation — so analysts can see precisely what drove the decision.
 */
export function ShapWaterfall({ attributions, count = 8 }) {
  const data = [...attributions]
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, count)
    .reverse() // largest at top in a horizontal chart
    .map((a) => ({
      name: a.label,
      value: a.shap_value,
      featureValue: a.value,
      direction: a.direction,
    }));

  return (
    <div style={{ width: '100%', height: Math.max(220, data.length * 34) }}>
      <ResponsiveContainer>
        <BarChart layout="vertical" data={data} margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={190}
            tick={{ fontSize: 11, fill: '#404040' }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="#d4d4d4" />
          <Tooltip
            cursor={{ fill: '#f5f5f5' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
            formatter={(v) => [v.toFixed(4), 'SHAP contribution']}
            labelFormatter={(l, p) =>
              `${l} — value ${p?.[0]?.payload?.featureValue ?? ''}`
            }
          />
          <Bar dataKey="value" radius={3} barSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 0 ? '#dc2626' : '#16a34a'} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
              style={{ fontSize: 10, fill: '#737373' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

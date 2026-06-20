import { Link } from 'react-router-dom';

import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { api } from '../lib/api.js';
import { fmtDateTime, fmtPercent } from '../lib/format.js';
import { riskStyle } from '../lib/risk.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Operational dashboard.
 *
 * Three things an analyst lead needs on opening the console: the triage queue shape (how
 * many alerts and at what severity), the model's current health and calibrated quality,
 * and which signals are driving decisions. Every figure is computed from live data — no
 * placeholders.
 */
export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary(), []);

  return (
    <>
      <Topbar title="Dashboard" subtitle="Risk triage overview" />
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            <BandSummary byBand={data.byBand} totals={data.totals} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ModelCard model={data.model} />
              <SignalsCard model={data.model} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function BandSummary({ byBand, totals }) {
  const cards = [
    { band: 'critical', count: byBand.critical },
    { band: 'high', count: byBand.high },
    { band: 'medium', count: byBand.medium },
    { band: 'low', count: byBand.low },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ band, count }) => {
        const s = riskStyle(band);
        return (
          <Link
            key={band}
            to={`/alerts?band=${band}`}
            className="surface group p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-500">{s.label}</span>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold tnum text-neutral-900">{count}</div>
            <div className="mt-0.5 text-xs text-neutral-400">
              {count === 1 ? 'alert' : 'alerts'} in queue
            </div>
          </Link>
        );
      })}
      <div className="surface col-span-2 flex items-center justify-between p-4 lg:col-span-4">
        <Stat label="Transactions analyzed" value={totals.analyzed} />
        <Divider />
        <Stat label="Open alerts" value={totals.openAlerts} />
        <Divider />
        <Stat label="Reports generated" value={totals.reports} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex-1 text-center">
      <div className="text-xl font-semibold tnum text-neutral-900">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-neutral-200" />;
}

function ModelCard({ model }) {
  if (!model) {
    return (
      <Card>
        <CardHeader title="Model health" />
        <CardBody>
          <p className="text-sm text-neutral-500">
            ML service is unreachable. Scoring is unavailable until it is restored.
          </p>
        </CardBody>
      </Card>
    );
  }
  const m = model.metrics ?? {};
  const b = model.baseline ?? {};
  return (
    <Card>
      <CardHeader
        title="Model health"
        description={`${model.version} · trained ${fmtDateTime(model.trainedAt)}`}
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Metric label="PR-AUC" value={m.pr_auc} hint="Precision–recall area" />
          <Metric label="ROC-AUC" value={m.roc_auc} />
          <Metric label="Precision" value={fmtPercent(m.precision)} raw />
          <Metric label="Recall" value={fmtPercent(m.recall)} raw />
          <Metric label="Brier score" value={m.brier} hint="Lower = better calibrated" />
          <Metric
            label="vs. RF baseline (Brier)"
            value={b.brier != null ? b.brier : '—'}
            hint="Random Forest comparison"
          />
        </div>
        <p className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-400">
          Metrics measured on a held-out, time-split test fold of synthetic PaySim-schema
          data. They describe this model build, not production traffic.
        </p>
      </CardBody>
    </Card>
  );
}

function Metric({ label, value, hint, raw }) {
  return (
    <div>
      <div className="text-lg font-semibold tnum text-neutral-900">
        {raw ? value : typeof value === 'number' ? value.toFixed(3) : value}
      </div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      {hint && <div className="text-[11px] text-neutral-400">{hint}</div>}
    </div>
  );
}

function SignalsCard({ model }) {
  const features = model?.topFeatures ?? [];
  const max = features[0]?.importance ?? 1;
  return (
    <Card>
      <CardHeader
        title="Top decision signals"
        description="Global SHAP importance across recent scoring"
      />
      <CardBody className="space-y-2.5">
        {features.length === 0 && <p className="text-sm text-neutral-500">No model loaded.</p>}
        {features.map((f) => (
          <div key={f.feature}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-700">{f.feature}</span>
              <span className="tnum text-neutral-400">{f.importance.toFixed(3)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-accent-500"
                style={{ width: `${(f.importance / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

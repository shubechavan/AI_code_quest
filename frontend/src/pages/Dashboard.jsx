import { Link } from 'react-router-dom';

import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { ErrorState, SkeletonCards } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { MotionItem, MotionList, PageTransition } from '../components/ui/motion.jsx';
import { api } from '../lib/api.js';
import { fmtDateTime, fmtPercent } from '../lib/format.js';
import { riskStyle } from '../lib/risk.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Operational dashboard.
 *
 * Three things a desk lead needs on opening the console: the triage queue shape (how many
 * alerts and at what severity), the model's current health and calibrated quality, and
 * which signals are driving decisions. Every figure is computed from live data — there are
 * no placeholder KPIs anywhere on this page.
 */
export function Dashboard() {
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary(), []);

  return (
    <>
      <Topbar title="Dashboard" subtitle="Financial-crime risk overview" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {loading ? (
            <>
              <SkeletonCards count={4} />
              <SkeletonCards count={2} />
            </>
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <PageTransition className="space-y-6">
              <BandSummary byBand={data.byBand} totals={data.totals} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ModelCard model={data.model} />
                <SignalsCard model={data.model} />
              </div>
            </PageTransition>
          )}
        </div>
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
    <div className="space-y-4">
      <MotionList className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ band, count }) => {
          const s = riskStyle(band);
          return (
            <MotionItem key={band}>
              <Link
                to={`/alerts?band=${band}`}
                className="group block overflow-hidden rounded-xl border border-line bg-surface p-4 transition-all hover:border-faint/40 hover:shadow-elevated"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">{s.label}</span>
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                </div>
                <div className={`mt-2 text-2xl font-semibold tnum ${s.text}`}>{count}</div>
                <div className="mt-0.5 text-xs text-faint">
                  {count === 1 ? 'alert' : 'alerts'} in queue
                </div>
              </Link>
            </MotionItem>
          );
        })}
      </MotionList>

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
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
      <div className="text-xl font-semibold tnum text-fg">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-line" />;
}

function ModelCard({ model }) {
  if (!model) {
    return (
      <Card>
        <CardHeader title="Model health" />
        <CardBody>
          <p className="text-sm text-muted">
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
          <Metric label="Brier score" value={m.brier} hint="Lower = better calibrated" small />
          <Metric label="RF baseline (Brier)" value={b.brier ?? '—'} hint="Comparison model" small />
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
          Measured on a held-out, time-split test fold that retains the true class prior.
        </p>
      </CardBody>
    </Card>
  );
}

function Metric({ label, value, hint, raw, small }) {
  const display =
    raw || typeof value !== 'number'
      ? value
      : small
        ? value.toExponential(1)
        : value.toFixed(3);
  return (
    <div>
      <div className="text-lg font-semibold tnum text-fg">{display}</div>
      <div className="text-xs font-medium text-muted">{label}</div>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
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
        {features.length === 0 && <p className="text-sm text-muted">No model loaded.</p>}
        {features.map((f) => (
          <div key={f.feature}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-fg">{f.feature}</span>
              <span className="tnum text-faint">{f.importance.toFixed(3)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all"
                style={{ width: `${(f.importance / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

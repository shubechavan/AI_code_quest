import { Link, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { RiskBadge } from '../components/ui/RiskBadge.jsx';
import { api } from '../lib/api.js';
import { fmtCurrency, fmtDateTime, fmtPercent } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Print-ready investigation report.
 *
 * Rendered outside the app shell on a clean white page so the browser's Print → Save as
 * PDF produces a faithful document. The `.no-print` toolbar is hidden in print output.
 * This is the standard, infra-free approach to PDF export and yields pixel-accurate,
 * vector text.
 */
export function ReportView() {
  const { id } = useParams();
  const { data: report, loading, error, reload } = useAsync(() => api.getReport(id), [id]);

  if (loading) return <LoadingState label="Loading report…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const s = report.snapshot;
  const t = s.transaction;
  const b = s.brief;

  return (
    <div className="min-h-screen bg-base py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-4">
        <Link to="/reports" className="text-sm text-muted hover:text-fg">← All reports</Link>
        <Button onClick={() => window.print()}>Export PDF</Button>
      </div>

      <article className="print-surface mx-auto max-w-3xl bg-white p-10 shadow-elevated print:max-w-none print:shadow-none">
        {/* Letterhead */}
        <header className="flex items-start justify-between border-b border-neutral-200 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-xs font-bold text-white">DS</div>
            <div>
              <div className="text-sm font-semibold text-neutral-900">DarkSentinel</div>
              <div className="text-xs text-neutral-500">Investigation Report</div>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            <div>Report {report._id}</div>
            <div>{fmtDateTime(report.createdAt)}</div>
            <div>Model {report.modelVersion}</div>
          </div>
        </header>

        {/* Summary band */}
        <section className="mt-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Transaction {report.transactionId}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Prepared by {report.generatedByName} · {t.type} · {fmtCurrency(t.amount)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tnum text-neutral-900">{s.compositeScore}</div>
            <RiskBadge band={s.riskBand} />
          </div>
        </section>

        <dl className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-neutral-50 p-4 text-sm">
          <Pair label="Supervised probability" value={fmtPercent(s.supervisedProbability)} />
          <Pair label="Anomaly score" value={s.anomalyScore.toFixed(2)} />
          <Pair label="Graph risk" value={s.graphRisk.toFixed(2)} />
        </dl>

        {/* Brief sections */}
        <ReportSection title="Risk summary"><p>{b.risk_summary}</p></ReportSection>
        <ReportSection title="Contributing factors"><Bullets items={b.contributing_factors} /></ReportSection>
        <ReportSection title="Network concerns"><Bullets items={b.network_concerns} /></ReportSection>
        <ReportSection title="Sanctions status"><p>{b.sanctions_status}</p></ReportSection>
        <ReportSection title="Recommended action"><p className="font-medium">{b.recommended_action}</p></ReportSection>

        <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-400">
          {b.confidence_note} This report is a point-in-time snapshot; re-scoring the
          transaction does not alter it.
        </footer>
      </article>
    </div>
  );
}

function Pair({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tnum text-neutral-900">{value}</dd>
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="text-sm leading-relaxed text-neutral-800">{children}</div>
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

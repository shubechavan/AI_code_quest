import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { NetworkGraph } from '../components/charts/NetworkGraph.jsx';
import { ScoreGauge } from '../components/charts/ScoreGauge.jsx';
import { ShapWaterfall } from '../components/charts/ShapWaterfall.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { RiskBadge } from '../components/ui/RiskBadge.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { Topbar } from '../components/layout/Topbar.jsx';
import { PageTransition } from '../components/ui/motion.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { fmtCurrency, fmtPercent, fmtRelative } from '../lib/format.js';
import { riskStyle } from '../lib/risk.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Risk analysis screen — the core investigation surface.
 *
 * Opens with a summary banner (the headline an analyst needs to triage in seconds), then
 * the full grounded evidence chain: the calibrated score and its four components, the exact
 * SHAP attributions, the transaction-graph structure, sanctions screening, and the
 * narrative brief. Everything is read top-to-bottom to justify a decision, then snapshotted
 * into a report.
 */
export function TransactionDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.getTransaction(id), [id]);

  return (
    <>
      <Topbar title="Risk Analysis" subtitle={id} />
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <Detail detail={data} canReport={hasPermission('report:generate')} />
        )}
      </main>
    </>
  );
}

function Detail({ detail, canReport }) {
  const { transaction: t, assessment: a } = detail;
  if (!a) return <ErrorState error={{ message: 'This transaction has not been scored.' }} />;

  const topDriver = a.contributingFactors?.find((f) => f.source === 'model');

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/alerts" className="text-sm text-muted hover:text-fg">← Back to queue</Link>
        {canReport && <GenerateReportButton assessmentId={a._id} />}
      </div>

      {/* Investigation summary banner */}
      <SummaryBanner t={t} a={a} topDriver={topDriver} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: score + components + transaction facts */}
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center">
              <ScoreGauge score={a.compositeScore} band={a.riskBand} />
              <div className="mt-5 w-full space-y-2.5 border-t border-line pt-4">
                <Component label="Fraud probability" value={fmtPercent(a.supervisedProbability)} weight="0.60" frac={a.supervisedProbability} />
                <Component label="Anomaly score" value={a.anomalyScore.toFixed(2)} weight="0.15" frac={a.anomalyScore} />
                <Component label="Graph risk" value={a.graphRisk.toFixed(2)} weight="0.15" frac={a.graphRisk} />
                <Component label="Sanctions risk" value={(a.sanctionsRisk ?? 0).toFixed(2)} weight="0.10" frac={a.sanctionsRisk ?? 0} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                Composite = 0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions, each an
                independently computed signal.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Transaction" />
            <CardBody className="space-y-2.5 text-sm">
              <Row label="Type" value={t.type} />
              <Row label="Amount" value={fmtCurrency(t.amount)} mono />
              <Row label="Origin" value={t.nameOrig} mono />
              <Row label="Origin balance" value={`${fmtCurrency(t.oldbalanceOrg)} → ${fmtCurrency(t.newbalanceOrig)}`} />
              <Row label="Destination" value={t.nameDest} mono />
              <Row label="Dest balance" value={`${fmtCurrency(t.oldbalanceDest)} → ${fmtCurrency(t.newbalanceDest)}`} />
              {t.counterparty_name && <Row label="Counterparty" value={t.counterparty_name} />}
            </CardBody>
          </Card>
        </div>

        {/* Right: SHAP + factors + graph + brief */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Why this score" description="Exact SHAP feature attributions for this prediction" />
            <CardBody>
              <ShapWaterfall attributions={a.explanation.attributions} />
              <div className="mt-2 flex items-center gap-4 text-[11px] text-faint">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500" /> Increases risk</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Decreases risk</span>
              </div>
            </CardBody>
          </Card>

          <ContributingFactors factors={a.contributingFactors} />

          {a.graphSignals && (
            <Card>
              <CardHeader title="Network structure" description="Local transaction graph around the origin account" />
              <CardBody>
                <NetworkGraph
                  edges={a.graphEdges ?? []}
                  focusAccount={t.nameOrig}
                  sanctioned={a.graphSignals.path_to_sanctioned?.length ? [a.graphSignals.path_to_sanctioned.at(-1)] : []}
                />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <GraphStat label="Mule pattern" value={a.graphSignals.is_mule_pattern ? 'Yes' : 'No'} alert={a.graphSignals.is_mule_pattern} />
                  <GraphStat label="Fan-in / out" value={`${a.graphSignals.fan_in} / ${a.graphSignals.fan_out}`} />
                  <GraphStat label="Betweenness" value={a.graphSignals.betweenness_centrality.toFixed(3)} />
                  <GraphStat label="Hops to sanctioned" value={a.graphSignals.distance_to_sanctioned ?? '—'} alert={a.graphSignals.distance_to_sanctioned != null} />
                </div>
              </CardBody>
            </Card>
          )}

          <InvestigationBrief brief={a.brief} />
        </div>
      </div>
    </PageTransition>
  );
}

function SummaryBanner({ t, a, topDriver }) {
  const s = riskStyle(a.riskBand);
  const headline = a.brief?.recommended_action?.split('. ')[0] ?? 'Review recommended.';
  return (
    <div className={`overflow-hidden rounded-xl border ${s.border} bg-surface`}>
      <div className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${s.bg}`}>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tnum ${s.bg} ${s.text} border ${s.border}`}>
          {a.compositeScore}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge band={a.riskBand} />
            <span className="text-sm text-muted">
              {t.type} · {fmtCurrency(t.amount)} · detected {fmtRelative(a.createdAt ?? t.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-fg">{headline}.</p>
        </div>
        <div className="hidden shrink-0 gap-6 sm:flex">
          <MiniSignal label="Fraud" value={fmtPercent(a.supervisedProbability)} />
          <MiniSignal label="Graph" value={a.graphRisk.toFixed(2)} />
          <MiniSignal label="Sanctions" value={(a.sanctionsRisk ?? 0).toFixed(2)} />
        </div>
      </div>
      {topDriver && (
        <div className="border-t border-line px-5 py-2.5 text-xs text-muted">
          Primary driver: <span className="text-fg">{topDriver.label}</span>
          <span className="tnum text-faint"> · +{topDriver.contribution?.toFixed(3)} log-odds</span>
        </div>
      )}
    </div>
  );
}

function MiniSignal({ label, value }) {
  return (
    <div className="text-right">
      <div className="text-sm font-semibold tnum text-fg">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function GenerateReportButton({ assessmentId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  async function generate() {
    setLoading(true);
    try {
      const report = await api.generateReport(assessmentId);
      navigate(`/reports/${report._id}/view`);
    } finally {
      setLoading(false);
    }
  }
  return <Button onClick={generate} loading={loading}>Generate investigation report</Button>;
}

function Component({ label, value, weight, frac }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {label}
          {weight && <span className="ml-1.5 rounded bg-elevated px-1 py-0.5 text-[10px] font-medium tnum text-faint">×{weight}</span>}
        </span>
        <span className="tnum font-semibold text-fg">{value}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent-500/70" style={{ width: `${Math.min(100, (frac ?? 0) * 100)}%` }} />
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={`text-right text-fg ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function ContributingFactors({ factors }) {
  const model = factors.filter((f) => f.source === 'model');
  const graph = factors.filter((f) => f.source === 'graph');
  const sanctions = factors.filter((f) => f.source === 'sanctions');
  return (
    <Card>
      <CardHeader title="Contributing factors" description="The grounded evidence the brief is built from" />
      <CardBody className="space-y-3">
        {model.map((f, i) => (
          <Factor key={`m${i}`} source="Model" label={f.label} detail={`value ${f.value} · +${f.contribution?.toFixed(3)} log-odds`} />
        ))}
        {graph.map((f, i) => (
          <Factor key={`g${i}`} source="Graph" label={f.label} detail={f.path ? f.path.join(' → ') : ''} accent />
        ))}
        {sanctions.map((f, i) => (
          <Factor key={`s${i}`} source="Sanctions" label={f.label} detail={`match risk ${f.value}`} danger />
        ))}
        {factors.length === 0 && <p className="text-sm text-muted">No strong contributing factors.</p>}
      </CardBody>
    </Card>
  );
}

function Factor({ source, label, detail, accent, danger }) {
  const tone = danger ? 'bg-rose-500/10 text-rose-400' : accent ? 'bg-accent-500/10 text-accent-400' : 'bg-elevated text-muted';
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>{source}</span>
      <div>
        <div className="text-sm text-fg">{label}</div>
        {detail && <div className="font-mono text-[11px] text-faint">{detail}</div>}
      </div>
    </div>
  );
}

function GraphStat({ label, value, alert }) {
  return (
    <div className={`rounded-lg border p-2.5 ${alert ? 'border-rose-500/30 bg-rose-500/10' : 'border-line bg-elevated'}`}>
      <div className={`text-sm font-semibold tnum ${alert ? 'text-rose-400' : 'text-fg'}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function InvestigationBrief({ brief }) {
  if (!brief) return null;
  return (
    <Card>
      <CardHeader
        title="Investigation brief"
        description="Grounded narrative — every statement maps to a computed input"
        actions={
          <span className="rounded bg-elevated px-2 py-0.5 text-[11px] font-medium text-muted">
            {brief.generated_by === 'claude' ? 'Claude (grounded)' : 'Deterministic'}
          </span>
        }
      />
      <CardBody className="space-y-4 text-sm">
        <Section title="Risk summary"><p className="text-fg/90">{brief.risk_summary}</p></Section>
        <Section title="Contributing factors"><List items={brief.contributing_factors} /></Section>
        <Section title="Network concerns"><List items={brief.network_concerns} /></Section>
        <Section title="Sanctions status"><p className="text-fg/90">{brief.sanctions_status}</p></Section>
        <div className="rounded-lg border border-accent-500/30 bg-accent-500/10 p-3">
          <div className="text-xs font-semibold text-accent-400">Recommended action</div>
          <p className="mt-0.5 text-sm text-fg">{brief.recommended_action}</p>
        </div>
        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-faint">{brief.confidence_note}</p>
      </CardBody>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">{title}</div>
      {children}
    </div>
  );
}

function List({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-fg/90">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" />
          {it}
        </li>
      ))}
    </ul>
  );
}

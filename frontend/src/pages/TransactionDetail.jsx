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
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { fmtCurrency, fmtPercent } from '../lib/format.js';
import { useAsync } from '../lib/useAsync.js';

/**
 * Risk analysis screen — the core investigation surface.
 *
 * Lays out the full grounded evidence chain for one transaction: the calibrated score and
 * its components, the exact SHAP attributions that produced it, the transaction-graph
 * structure, sanctions screening, and the narrative brief. An analyst can read top-to-
 * bottom and justify a decision without leaving the page, then snapshot it into a report.
 */
export function TransactionDetail() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.getTransaction(id), [id]);

  return (
    <>
      <Topbar title="Risk Analysis" subtitle={`Transaction ${id}`} />
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
  if (!a) {
    return <ErrorState error={{ message: 'This transaction has not been scored.' }} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/alerts" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Back to queue
        </Link>
        {canReport && <GenerateReportButton assessmentId={a._id} />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: score + components + transaction facts */}
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center">
              <ScoreGauge score={a.compositeScore} band={a.riskBand} />
              <div className="mt-4 w-full space-y-2 border-t border-neutral-100 pt-4">
                <Component label="Supervised probability" value={fmtPercent(a.supervisedProbability)} weight="primary" />
                <Component label="Anomaly score" value={a.anomalyScore.toFixed(2)} />
                <Component label="Graph risk" value={a.graphRisk.toFixed(2)} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
                Composite blends a calibrated XGBoost probability with Isolation-Forest
                anomaly detection; graph risk can only raise the score.
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

        {/* Right: SHAP + factors + graph + brief (spans two columns) */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Why this score"
              description="Exact SHAP feature attributions for this prediction"
            />
            <CardBody>
              <ShapWaterfall attributions={a.explanation.attributions} />
              <div className="mt-2 flex items-center gap-4 text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-red-600" /> Increases risk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-green-600" /> Decreases risk
                </span>
              </div>
            </CardBody>
          </Card>

          <ContributingFactors factors={a.contributingFactors} />

          {a.graphSignals && (
            <Card>
              <CardHeader
                title="Network structure"
                description="Local transaction graph around the origin account"
              />
              <CardBody>
                <NetworkGraph
                  edges={a.graphEdges ?? []}
                  focusAccount={t.nameOrig}
                  sanctioned={
                    a.graphSignals.path_to_sanctioned?.length
                      ? [a.graphSignals.path_to_sanctioned.at(-1)]
                      : []
                  }
                />
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <GraphStat label="Mule pattern" value={a.graphSignals.is_mule_pattern ? 'Yes' : 'No'} alert={a.graphSignals.is_mule_pattern} />
                  <GraphStat label="Fan-in / out" value={`${a.graphSignals.fan_in} / ${a.graphSignals.fan_out}`} />
                  <GraphStat label="Betweenness" value={a.graphSignals.betweenness_centrality.toFixed(3)} />
                  <GraphStat
                    label="Hops to sanctioned"
                    value={a.graphSignals.distance_to_sanctioned ?? '—'}
                    alert={a.graphSignals.distance_to_sanctioned != null}
                  />
                </div>
              </CardBody>
            </Card>
          )}

          <InvestigationBrief brief={a.brief} />
        </div>
      </div>
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
  return (
    <Button onClick={generate} loading={loading}>
      Generate investigation report
    </Button>
  );
}

function Component({ label, value, weight }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-500">
        {label}
        {weight === 'primary' && (
          <span className="ml-1.5 rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-medium text-neutral-500">
            primary
          </span>
        )}
      </span>
      <span className="tnum font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className={`text-right text-neutral-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function ContributingFactors({ factors }) {
  const model = factors.filter((f) => f.source === 'model');
  const graph = factors.filter((f) => f.source === 'graph');
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
        {factors.length === 0 && <p className="text-sm text-neutral-500">No strong contributing factors.</p>}
      </CardBody>
    </Card>
  );
}

function Factor({ source, label, detail, accent }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
          accent ? 'bg-accent-50 text-accent-700' : 'bg-neutral-100 text-neutral-500'
        }`}
      >
        {source}
      </span>
      <div>
        <div className="text-sm text-neutral-800">{label}</div>
        {detail && <div className="font-mono text-[11px] text-neutral-400">{detail}</div>}
      </div>
    </div>
  );
}

function GraphStat({ label, value, alert }) {
  return (
    <div className={`rounded-md border p-2.5 ${alert ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'}`}>
      <div className={`text-sm font-semibold tnum ${alert ? 'text-red-700' : 'text-neutral-900'}`}>{value}</div>
      <div className="text-[11px] text-neutral-500">{label}</div>
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
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
            {brief.generated_by === 'claude' ? 'Claude (grounded)' : 'Deterministic'}
          </span>
        }
      />
      <CardBody className="space-y-4 text-sm">
        <Section title="Risk summary">
          <p className="text-neutral-700">{brief.risk_summary}</p>
        </Section>
        <Section title="Contributing factors">
          <List items={brief.contributing_factors} />
        </Section>
        <Section title="Network concerns">
          <List items={brief.network_concerns} />
        </Section>
        <Section title="Sanctions status">
          <p className="text-neutral-700">{brief.sanctions_status}</p>
        </Section>
        <div className="rounded-md border border-accent-100 bg-accent-50 p-3">
          <div className="text-xs font-semibold text-accent-800">Recommended action</div>
          <p className="mt-0.5 text-sm text-accent-900">{brief.recommended_action}</p>
        </div>
        <p className="border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-400">
          {brief.confidence_note}
        </p>
      </CardBody>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</div>
      {children}
    </div>
  );
}

function List({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-neutral-700">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
          {it}
        </li>
      ))}
    </ul>
  );
}

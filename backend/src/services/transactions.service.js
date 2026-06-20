/**
 * Transaction orchestration.
 *
 * Coordinates the full analyze flow: persist the raw transaction, call the ML service for
 * a grounded assessment, persist the assessment, and open an alert when the risk band
 * warrants analyst attention. This is the gateway's core business workflow; routes call
 * into it so the sequence is testable and consistent.
 */
import { db } from '../data/store.js';

const ALERT_BANDS = new Set(['high', 'critical']);

/**
 * Analyze a transaction end-to-end.
 * @param {object} params
 * @param {object} params.transaction  Raw PaySim-schema transaction.
 * @param {Array}  params.graphEdges   Optional local subgraph for structural analysis.
 * @param {Array}  params.sanctionedAccounts
 * @param {object} params.user         Authenticated actor (for tenant + audit).
 * @param {object} params.mlClient
 */
export async function analyzeTransaction({
  transaction,
  graphEdges = [],
  sanctionedAccounts = [],
  user,
  mlClient,
}) {
  const stored = db.transactions.insert({
    ...transaction,
    tenantId: user.tenantId,
    submittedBy: user.id,
  });

  const scored = await mlClient.score({
    transaction: { ...transaction, transaction_id: stored._id },
    graph_edges: graphEdges,
    sanctioned_accounts: sanctionedAccounts,
    include_brief: true,
  });

  const assessment = db.assessments.insert({
    transactionId: stored._id,
    tenantId: user.tenantId,
    modelVersion: scored.model_version,
    compositeScore: scored.composite_score,
    riskBand: scored.risk_band,
    supervisedProbability: scored.supervised_probability,
    anomalyScore: scored.anomaly_score,
    graphRisk: scored.graph_risk,
    explanation: scored.explanation,
    graphSignals: scored.graph_signals,
    graphEdges,
    contributingFactors: scored.contributing_factors,
    brief: scored.brief,
  });

  let alert = null;
  if (ALERT_BANDS.has(scored.risk_band)) {
    alert = db.alerts.insert({
      transactionId: stored._id,
      assessmentId: assessment._id,
      tenantId: user.tenantId,
      riskBand: scored.risk_band,
      compositeScore: scored.composite_score,
      state: 'open', // open -> in_review -> resolved | escalated
      assignedTo: null,
      sarStatus: 'not_filed',
    });
  }

  return { transaction: stored, assessment, alert };
}

/** A transaction with its latest assessment and alert, tenant-scoped. */
export function getTransactionDetail(transactionId, tenantId) {
  const transaction = db.transactions.get(transactionId);
  if (!transaction || transaction.tenantId !== tenantId) return null;
  const assessment = db.assessments.findOne(
    (a) => a.transactionId === transactionId && a.tenantId === tenantId,
  );
  const alert = db.alerts.findOne((a) => a.transactionId === transactionId);
  return { transaction, assessment, alert };
}

/** Paginated, filterable transaction list joined with assessment summary. */
export function listTransactions({ tenantId, band, search, limit = 50 }) {
  const assessments = db.assessments.find((a) => a.tenantId === tenantId);
  const byTxn = new Map(assessments.map((a) => [a.transactionId, a]));

  let rows = db.transactions
    .find((t) => t.tenantId === tenantId)
    .map((t) => ({ transaction: t, assessment: byTxn.get(t._id) ?? null }))
    .filter((r) => r.assessment); // only analyzed transactions surface in the queue

  if (band) rows = rows.filter((r) => r.assessment.riskBand === band);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.transaction._id.toLowerCase().includes(q) ||
        r.transaction.nameOrig?.toLowerCase().includes(q) ||
        r.transaction.nameDest?.toLowerCase().includes(q),
    );
  }

  rows.sort((a, b) => b.assessment.compositeScore - a.assessment.compositeScore);
  return rows.slice(0, limit);
}

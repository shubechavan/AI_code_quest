# Data provenance — `/transactions/:id` and the investigation workflow

This document traces **every value displayed** on the Risk Analysis page
([`frontend/src/pages/TransactionDetail.jsx`](frontend/src/pages/TransactionDetail.jsx))
and the downstream report to its exact origin. It is the audit response to "is anything on
this page hardcoded, mock, or demo-only?"

**Result of the audit:** the page renders no fabricated values. Every number and string is
either (a) computed by the model/SHAP/graph/sanctions layers, or (b) a field of the input
transaction. The single item that was a static template — `recommended_action` (a
band→string lookup) — has been **replaced with a computed implementation** that assembles
the recommendation from the transaction's real evidence
([`explain/narrative.py:recommend_action`](ml-service/darksentinel/explain/narrative.py)).

Static text that remains on the page is **UI chrome** (section titles, the chart legend,
the "Composite = 0.60·fraud + …" caption) — labels, not data.

## How a value reaches the screen

```
POST /score (FastAPI)                         GET /api/transactions/:id (Express)
  feature vector ─ XGBoost ─ isotonic ─┐         reads the persisted assessment
  IsolationForest ─────────────────────┤                     │
  NetworkX graph signals ──────────────┼── RiskAssessment ───┤── stored at analyze time
  RapidFuzz over real OFAC ────────────┤     (+ brief)        │   (transactions.service.js)
  SHAP TreeExplainer ──────────────────┘                     ▼
                                                  TransactionDetail.jsx renders fields
```

Nothing is computed in the browser except formatting (currency, percent) and chart layout.

## Field-by-field audit

| Field (as shown) | Source | Real or Mock | File location (producer) |
| --- | --- | --- | --- |
| **Risk Score** (gauge) | Computed — 4-signal composite `0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions` | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py) `CompositeScorer.score` |
| **Risk Band** | Computed — threshold map over the composite score | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py) `_band` + [`config.py`](ml-service/darksentinel/config.py) `RISK_BANDS` |
| **Fraud Probability** | Model output — XGBoost `predict_proba` → isotonic calibration | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py); trained in [`models/train.py`](ml-service/darksentinel/models/train.py) |
| **Anomaly Score** | Model output — IsolationForest `score_samples`, min-max normalised | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py); trained in [`models/train.py`](ml-service/darksentinel/models/train.py) |
| **Graph Risk** | Graph analytics — weighted blend of centrality/mule/sanctioned-path | **Real** | [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) `_composite_graph_risk` |
| **Sanctions Risk** | Sanctions — `max(name-match similarity, FATF country risk)` | **Real** | [`api/main.py`](ml-service/darksentinel/api/main.py) `score`; [`sanctions/screening.py`](ml-service/darksentinel/sanctions/screening.py) |
| **SHAP Waterfall** (bars) | SHAP — exact per-feature contribution for this row | **Real** | [`explain/shap_explainer.py`](ml-service/darksentinel/explain/shap_explainer.py) `explain_row`; rendered [`charts/ShapWaterfall.jsx`](frontend/src/components/charts/ShapWaterfall.jsx) |
| **Contributing Factors** (Model rows) | SHAP — top positive attributions with their values | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py) `_contributing_factors` |
| **Contributing Factors** (Graph rows) | Graph analytics — mule / betweenness / sanctioned-distance | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py) `_contributing_factors` ← [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) |
| **Contributing Factors** (Sanctions row) | Sanctions — present only when a name match fired | **Real** | [`models/scoring.py`](ml-service/darksentinel/models/scoring.py) `_contributing_factors` |
| **Network Graph** (nodes/edges) | Input edges + computed node roles (focus / sanctioned / normal) | **Real (input + computed roles)** | edges supplied per-request; roles computed in [`charts/NetworkGraph.jsx`](frontend/src/components/charts/NetworkGraph.jsx) |
| **Mule Pattern** (Yes/No) | Graph analytics — receive-and-forward detector | **Real** | [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) `_detect_mule` |
| **Fan-in / Fan-out** | Graph analytics — in/out degree of the focus node | **Real** | [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) `analyse_account` |
| **Betweenness** | Graph analytics — `nx.betweenness_centrality` (sampled on large graphs) | **Real** | [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) `analyse_account` |
| **Hops to Sanctioned** (+ Shortest Path) | Graph analytics — `nx.shortest_path` to nearest flagged node | **Real** | [`graph/analytics.py`](ml-service/darksentinel/graph/analytics.py) `_shortest_to_sanctioned` |
| **Matched Sanction Entity** (in brief) | Sanctions — RapidFuzz match over the **live OFAC SDN list** | **Real** | [`sanctions/screening.py`](ml-service/darksentinel/sanctions/screening.py) `screen` / `summarise`; ingested by [`scripts/ingest_sanctions.py`](ml-service/scripts/ingest_sanctions.py) |
| **Investigation Brief — Risk summary** | Narrative — interpolates the real score, probability, anomaly, graph risk | **Real (grounded)** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) `DeterministicNarrator.write` |
| **Investigation Brief — Contributing factors** | Narrative — restates the real SHAP attributions | **Real (grounded)** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) |
| **Investigation Brief — Network concerns** | Narrative — restates the real graph findings | **Real (grounded)** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) |
| **Investigation Brief — Sanctions status** | Sanctions — the real match summary string | **Real** | [`sanctions/screening.py`](ml-service/darksentinel/sanctions/screening.py) `summarise` |
| **Recommended Action** | Computed — assembled from band + sanctions + mule + sanctioned-path + top driver | **Real (was a band lookup; now computed)** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) `recommend_action` |
| **Confidence note** | Narrative — methodology disclaimer interpolating the real model version + probability | **Real (grounded)** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) |
| **Brief source badge** ("Deterministic" / "Claude") | Which narrator actually ran | **Real** | [`explain/narrative.py`](ml-service/darksentinel/explain/narrative.py) `get_narrator` |
| **Transaction facts** (type, amount, origin/dest, balances, counterparty) | Input transaction data | **Real input** | persisted by [`backend/.../transactions.service.js`](backend/src/services/transactions.service.js); originally from the analyze request |

## The one change made by this audit

`recommended_action` was previously `RECOMMENDED_ACTIONS[band]` — a static dictionary of
four strings keyed only on the risk band. It is now produced by `recommend_action(a)`,
which reads the assessment's actual signals and includes a step **only when that signal is
present**:

- base urgency from the computed band;
- a SAR / blocking step **iff** `sanctions_risk > 0`;
- a chain-expansion step **iff** the graph found a mule pattern (with the real fan-in/out);
- a path-tracing step **iff** a sanctioned account is reachable (with the real hop count);
- otherwise, a pointer to the real top SHAP driver for model-dominant alerts.

Verified output now differs per transaction (critical mule case vs. model-only drain vs.
clean payment all produce distinct, evidence-specific recommendations).

## On "input data" vs "computed output"

Two field groups are **input**, not model output, and are labelled as such above:

- **Transaction facts** — the record being scored.
- **Network Graph edges** — the local transaction subgraph.

For the seeded demo rows these inputs come from
[`scripts/seed_scenarios.py`](ml-service/scripts/seed_scenarios.py) (curated *sample
fixtures*, the same role as seed data in any application). For ad-hoc reviews they come from
the analyst's submission on the Analyze page. In production they originate from the
transaction ledger. In **all three cases the analytics computed from them — score, SHAP,
graph metrics, sanctions match — are real**; only the input rows differ in source. No
displayed *output* is fabricated.

## Reproduce the audit

```bash
# Every value below is recomputed live from the running services:
curl -s localhost:4000/api/transactions/<id> -H "Authorization: Bearer <token>" | jq '.assessment'
# Cross-check the raw model output (no gateway/storage in between):
curl -s localhost:8000/score -d @scenario.json -H 'Content-Type: application/json' | jq
```

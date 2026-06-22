# Architecture — DarkSentinel AI

Explainable Financial Crime Intelligence Platform. This document is the current,
consolidated architecture reference. See [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md) for the
field-by-field map of every value shown in the UI to the code that computes it.

## System overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Analyst console — React + Vite + Tailwind (dark-default), Recharts,       │
│  React Flow, Framer Motion                                       :5173     │
│  Dashboard · Alert Queue · Risk Analysis · Graph · Reports · Audit · Admin │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / JSON · Bearer access token
┌───────────────────────────────▼──────────────────────────────────────────┐
│  API gateway — Node.js + Express                                  :4000    │
│  helmet · CORS · rate limit · JWT RS256 · RBAC · audit · Zod validation    │
│  Orchestration: persist → score → open alert → snapshot report             │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP / JSON · trusted internal call
┌───────────────────────────────▼──────────────────────────────────────────┐
│  ML service — Python + FastAPI                                    :8000    │
│                                                                            │
│   XGBoost ─ isotonic calibration ─┐                                        │
│   Isolation Forest ───────────────┤── composite risk (0–100)               │
│   NetworkX graph signals ─────────┤   0.60·fraud + 0.15·anomaly            │
│   RapidFuzz over live OFAC SDN ───┘   + 0.15·graph + 0.10·sanctions        │
│   SHAP TreeExplainer ── exact per-prediction attributions                  │
│   Narrative layer ── grounded brief (deterministic | Claude)               │
└────────────────────────────────────────────────────────────────────────────┘
```

The pipeline the product promises, made concrete — every arrow is a real call in this repo:

```
React  →  Express  →  FastAPI  →  XGBoost  →  SHAP  →  NetworkX  →  Sanctions  →  Brief
(UI)     (auth)      (serving)   (decide)    (explain) (structure) (screen)      (narrate)
```

## Components

| Layer | Stack | Responsibility |
| --- | --- | --- |
| `frontend/` | React 18, Vite, Tailwind (semantic-token dark theme), Recharts, React Flow, Framer Motion | Analyst console; every value is API-driven |
| `backend/` | Node, Express | Auth (JWT RS256), RBAC, audit, rate limiting, transaction orchestration, persistence interface |
| `ml-service/` | Python, FastAPI, XGBoost, SHAP, scikit-learn, NetworkX, RapidFuzz | Scoring, calibration, anomaly, graph analytics, sanctions screening, grounded narrative |

## Data & models (all real)

- **Fraud model** — XGBoost trained on the **real 6,362,620-row PaySim dataset** (0.129%
  fraud), with a chronological split, undersample+SMOTE on the train fold only, and
  isotonic calibration on the true prior. Calibrated PR-AUC ≈ 0.99 (PaySim is known to be
  highly separable; leakage guarded by dropping `isFlaggedFraud` and verifying SHAP
  importance is spread across legitimate balance features).
- **Anomaly model** — Isolation Forest over legitimate traffic, normalised to [0,1].
- **Graph analytics** — NetworkX degree/betweenness/eigenvector centrality, mule
  receive-and-forward detection, shortest-path-to-sanctioned, on the local subgraph.
- **Sanctions** — RapidFuzz fuzzy matching over the **live OFAC SDN list** (~19k entities,
  ~20k aliases, ingested by `scripts/ingest_sanctions.py`) plus FATF country risk.
- **Explainability** — SHAP TreeExplainer gives the exact additive feature contribution
  for every prediction; the narrative layer may restate only those computed findings.

## Request flow: analyze a transaction

1. Analyst submits a transaction (`POST /api/transactions/analyze`).
2. Gateway authenticates (JWT RS256), authorizes (`transaction:analyze`), validates (Zod).
3. Gateway persists the raw transaction, calls the ML `/score` endpoint.
4. ML service builds 25 features → calibrated probability, anomaly, graph signals, sanctions
   match → composite score → SHAP attributions → grounded brief.
5. Gateway stores the assessment, opens an alert if band ∈ {high, critical}, writes an audit
   record, returns the result.
6. UI renders the summary banner, score gauge, SHAP waterfall, network graph, sanctions, and
   brief — see [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md) for the per-field source map.

## Security

JWT RS256 (auto-generated dev keys, secrets-manager in prod) · role-based access control
with per-route permissions · tenant isolation read from the token · bcrypt password hashing ·
helmet headers · per-IP and stricter per-auth rate limiting · Zod input validation ·
immutable audit log.

## Repository layout

```
darksentinel/
├── README.md  ARCHITECTURE.md  DATA_PROVENANCE.md
├── ml-service/      FastAPI · scoring, explainability, graph, sanctions, training
├── backend/         Express gateway · auth, RBAC, audit, orchestration
├── frontend/        React console · dark-default design system
└── datasets/        data card (PaySim placement, sanctions ingestion)
```

## Frontend design system

A semantic-token theme (`tailwind.config.js` + CSS variables in `index.css`): components
reference role-based colours (`surface`, `line`, `fg`, `muted`, `accent`, risk bands), and a
single class on `<html>` (`dark` default, `light`) flips the palette. Skeleton loaders,
restrained Framer Motion page/card transitions, and Recharts/React Flow theming give a calm,
consistent fintech console in the spirit of Linear / Datadog / Stripe.

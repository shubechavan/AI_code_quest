# DarkSentinel AI — Documentation

**Explainable Financial Crime Intelligence Platform.**

DarkSentinel scores transactions for money-laundering and fraud risk, then explains *why* —
grounding every analyst-facing narrative in a calibrated ML probability, exact SHAP feature
attributions, transaction-graph signals, and live sanctions screening. The model decides;
SHAP and the graph explain; the language layer only narrates.

This is the single-page reference. For deeper material see
[`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md),
[`VIDEO_DEMO.md`](VIDEO_DEMO.md), [`CHANGE.md`](CHANGE.md), and [`docs/archive/`](docs/archive/).

---

## Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech stack](#tech-stack)
5. [Project structure](#project-structure)
6. [Getting started](#getting-started)
7. [Data and machine learning](#data-and-machine-learning)
8. [Graph intelligence](#graph-intelligence)
9. [Sanctions screening](#sanctions-screening)
10. [Explainability and the grounded brief](#explainability-and-the-grounded-brief)
11. [Composite risk score](#composite-risk-score)
12. [API reference](#api-reference)
13. [Security](#security)
14. [Credentials](#credentials)
15. [What is and isn't production-grade](#what-is-and-isnt-production-grade)

---

## Overview

Existing transaction-monitoring systems flag activity with a rule name and no reasoning, so
analysts drown in false positives and cannot justify decisions. DarkSentinel replaces the
rule name with:

- a **calibrated probability** from a model trained on the real 6.3M-row PaySim dataset,
- the **exact SHAP attribution** that produced that probability,
- **transaction-graph structure** (mule detection, sanctioned-path proximity),
- **fuzzy sanctions screening** against the live OFAC list, and
- a **grounded investigation brief** an analyst can act on.

Every value displayed in the product is computed from these layers — there are no hardcoded
metrics, alerts, or model outputs (see [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md)).

---

## Features

| Screen | What it does |
| --- | --- |
| **Dashboard** | Live severity counts, model-health card (PR-AUC / ROC-AUC / Brier vs. baseline), and global SHAP decision signals. All API-driven. |
| **Alert Queue** | The analyst worklist: every analyzed transaction, filterable by severity, searchable, and sortable by score / amount / detection time. |
| **Risk Analysis** | Per-transaction investigation: summary banner, score gauge with the four-signal breakdown, SHAP waterfall, transaction network graph, sanctions match, and the grounded brief. |
| **Investigation Report** | One-click immutable snapshot of an assessment, print-ready (browser → Save as PDF), stamped with the model version. |
| **Audit Log** | Immutable record of who did what, when (analyze / report / user actions). Role-gated. |
| **Administration** | User directory; provisioning is server-enforced (admin only). |

The console is **dark-themed by default** with a light toggle, restrained Framer Motion
transitions, and skeleton loaders on every data view.

---

## Architecture

```
React console (Vite, Tailwind dark theme, Recharts, React Flow, Framer Motion)   :5173
        │  HTTPS / JSON · Bearer access token
API gateway (Node + Express): helmet · CORS · rate limit · JWT RS256 · RBAC      :4000
        │  audit · Zod validation · orchestration (persist → score → alert → report)
        │  HTTP / JSON · trusted internal call
ML service (Python + FastAPI)                                                    :8000
        XGBoost ─ isotonic ─┐
        Isolation Forest ───┤── composite risk (0–100)
        NetworkX ───────────┤   0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions
        RapidFuzz / OFAC ───┘
        SHAP TreeExplainer ── exact attributions
        Narrative layer ── grounded brief (deterministic | Claude)
```

The gateway owns trust (auth, RBAC, audit, persistence); the ML service owns the math and is
stateless. Full detail in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Tech stack

- **Frontend:** React 18, Vite, Tailwind (semantic-token theme), Recharts, React Flow,
  Framer Motion, React Router.
- **Gateway:** Node.js 20, Express, jsonwebtoken (RS256), bcryptjs, Zod, helmet,
  express-rate-limit.
- **ML service:** Python 3.12+, FastAPI, XGBoost, scikit-learn, imbalanced-learn, SHAP,
  NetworkX, RapidFuzz, pandas/numpy.

---

## Project structure

```
darksentinel/
├── documentation.md  ARCHITECTURE.md  CHANGE.md  VIDEO_DEMO.md  DATA_PROVENANCE.md  README.md
├── ml-service/                 # FastAPI: scoring, explainability, graph, sanctions, training
│   ├── darksentinel/
│   │   ├── data/               # loader (real PaySim) + synthetic fallback generator
│   │   ├── features/           # 25-feature pipeline (shared train/serve)
│   │   ├── models/             # train.py, scoring.py (composite)
│   │   ├── graph/              # NetworkX analytics
│   │   ├── explain/            # SHAP explainer + grounded narrative
│   │   ├── sanctions/          # RapidFuzz screening over real OFAC
│   │   └── api/main.py         # /health /model /score
│   └── scripts/                # train_model.py, ingest_sanctions.py, seed_scenarios.py
├── backend/                    # Express gateway
│   └── src/{config,middleware,services,routes,data}/
├── frontend/                   # React console
│   └── src/{lib,context,components,pages}/
├── datasets/                   # data card (PaySim placement)
└── docs/archive/               # detailed design notes
```

---

## Getting started

### Prerequisites
- Python 3.12+ and Node.js 20+
- Outbound internet for the live OFAC download (falls back to a sample offline)
- *(Optional)* the real PaySim CSV at `ml-service/data/raw/paysim/*.csv` — without it,
  training uses a schema-identical synthetic generator

### Run (three terminals)

```bash
# 1. ML service — ingest sanctions, train, serve
cd ml-service
pip install -r requirements.txt
python scripts/ingest_sanctions.py        # live OFAC SDN list (~19k entities)
python scripts/train_model.py             # trains on real PaySim if present, else synthetic
uvicorn darksentinel.api.main:app --port 8000

# 2. API gateway (seeds users + scores a realistic queue on boot)
cd backend
npm install
npm run dev                               # http://localhost:4000

# 3. Analyst console
cd frontend
npm install
npm run dev                               # http://localhost:5173
```

Open **http://localhost:5173** and sign in (see [Credentials](#credentials)). RS256 JWT keys
are auto-generated into `backend/keys/` on first boot (gitignored).

---

## Data and machine learning

**Primary model — XGBoost (calibrated).** Trained on the **real PaySim dataset**
(6,362,620 transactions, 0.129% fraud). Pipeline (`ml-service/darksentinel/models/train.py`):

1. Chronological 70/15/15 split on `step` — no temporal leakage.
2. `RandomUnderSampler` + `SMOTE` on the **training fold only**; calibration and test folds
   keep the true 0.129% prior so calibrated probabilities and metrics stay honest.
3. **Isotonic calibration** on a held-out fold so the probability means what it says.
4. **Isolation Forest** anomaly model on legitimate traffic, normalised to `[0,1]`.
5. **Random Forest** baseline on identical features for an honest comparison.
6. **SHAP TreeExplainer** bound to the model and persisted.

**Measured results (held-out, true-prior test fold):**

| Model | ROC-AUC | PR-AUC | Precision | Recall | Brier |
| --- | --- | --- | --- | --- | --- |
| XGBoost (calibrated) | 0.997 | 0.9935 | 1.000 | 0.9935 | 2.8e-05 |
| Random Forest (baseline) | — | 1.000 | 0.996 | 0.9995 | 3.2e-05 |

> **On "0.99 looks too good":** PaySim is a known, highly-separable dataset — fraud is
> mechanically tied to the balance-reconciliation features, so 0.99+ is the documented norm,
> not leakage. Guards: `isFlaggedFraud` (the obvious leak) is dropped at load, the split is
> chronological, and SHAP importance is spread across legitimate balance/amount features.
> We report PR-AUC / precision / recall / Brier — never accuracy, which is meaningless at
> 0.13% prevalence.

**Features.** 25 row-wise features (`features/engineering.py`) shared identically by training
and serving — no train/serve skew. Strongest signals are the PaySim balance-reconciliation
errors and drain-to-zero indicators, exactly what a human investigator looks at.

---

## Graph intelligence

Accounts are nodes; transfers are directed, weighted edges (`graph/analytics.py`, NetworkX).
For each investigation the local subgraph yields:

- **Centrality** — degree, betweenness (sampled on large graphs), eigenvector.
- **Mule detection** — receive-and-forward pattern with fan-in / fan-out.
- **Sanctioned-path search** — shortest directed path to the nearest flagged account.
- **Risk propagation** — damped diffusion of seed risk across neighbours.

These collapse into a transparent, auditable `graph_risk ∈ [0,1]` that feeds the composite
score, and each finding is surfaced individually in the brief.

---

## Sanctions screening

Real data. `scripts/ingest_sanctions.py` downloads and normalises the **live OFAC SDN list**
(SDN + ALT aliases + ADD addresses → ~19,000 entities, ~20,000 aliases). Screening
(`sanctions/screening.py`) matches a counterparty name against every primary name and alias
with **RapidFuzz** `token_set_ratio` (case-insensitive) above a 88% threshold, returning the
matched alias, score, program, and country for audit. **FATF** high-risk jurisdictions feed a
country-risk signal. If the index hasn't been ingested, a small clearly-labelled sample is
used so the service still runs offline.

---

## Explainability and the grounded brief

`shap.TreeExplainer` gives the **exact additive contribution** of every feature to one
prediction (`explain/shap_explainer.py`). The narrative layer (`explain/narrative.py`) turns
the computed evidence into an investigation brief under three anti-hallucination guarantees:

1. **Information starvation** — the narrator receives only the computed `contributing_factors`
   (SHAP + graph + sanctions), never the raw transaction, so it cannot re-derive risk.
2. **Instruction** — it is told to narrate the supplied findings and add nothing.
3. **Determinism by default** — with no `ANTHROPIC_API_KEY` it uses a reproducible template
   bound to the evidence; Claude is an opt-in upgrade on the same grounded inputs.

The **recommended action** is computed from the transaction's actual signals (SAR step only
when sanctions fire, chain expansion only when a mule pattern exists, path-tracing only when a
sanctioned account is reachable), so it differs per transaction rather than being a band lookup.

---

## Composite risk score

```
risk = 0.60·fraud_probability + 0.15·anomaly + 0.15·graph_risk + 0.10·sanctions_risk   (×100)
```

| Band | Score |
| --- | --- |
| Critical | 80–100 |
| High | 60–79 |
| Medium | 35–59 |
| Low | 0–34 |

The supervised model dominates; anomaly, graph, and sanctions are secondary lenses that
mostly raise attention. (On PaySim the calibrated model is decisive, so transactions tend to
land high or low — medium is genuinely rare; we show the real distribution.)

---

## API reference

Base URL (dev): `http://localhost:4000/api`. All routes except login/refresh require a Bearer
access token; authorization is per-route by RBAC permission. Full contract in
[`docs/archive/04-api.md`](docs/archive/04-api.md).

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/login` · `/auth/refresh` · `/auth/logout` | Session (RS256, refresh rotation) |
| POST | `/auth/register` | Admin-only user provisioning |
| POST | `/transactions/analyze` | Score + explain + persist + (maybe) open an alert |
| GET | `/transactions` · `/transactions/:id` · `/transactions/:id/graph` | Queue, detail, subgraph |
| POST | `/reports/:assessmentId/generate` · GET `/reports/:id` | Snapshot + fetch a report |
| GET | `/dashboard/summary` | Band counts, totals, model metrics |
| GET | `/admin/audit-logs` · `/admin/users` | Audit trail, user directory |

ML service (internal): `GET /health`, `GET /model`, `POST /score` — interactive docs at
`http://localhost:8000/docs`.

---

## Security

- **JWT RS256** access tokens (15m) + revocable, single-use refresh tokens (rotation).
- **RBAC** with per-route permissions across three personas (analyst, risk manager, admin).
- **Tenant isolation** read from the token, never from client input.
- **bcrypt** password hashing, **helmet** headers, **CORS** allow-list, per-IP and stricter
  per-auth **rate limiting**, **Zod** input validation, and an **immutable audit log**.
- Dev RS256 keys auto-generate into `backend/keys/` (gitignored); production keys come from a
  secrets manager.

---

## Credentials

Local demo accounts (the login screen has one-click role buttons):

| Role | Email | Password |
| --- | --- | --- |
| Analyst | `analyst@darksentinel.io` | `Analyst#2026` |
| Risk Manager | `manager@darksentinel.io` | `Manager#2026` |
| Admin | `admin@darksentinel.io` | `Admin#2026` |

---

## What is and isn't production-grade

**Real and verified:** real 6.3M-row PaySim training, live OFAC sanctions screening, exact
SHAP explainability, NetworkX graph analytics, calibrated four-signal scoring, JWT/RBAC/audit,
and an API-driven dark-themed console with no hardcoded values.

**Designed with seams, not yet built:** MongoDB persistence (the in-memory store implements a
Mongo-shaped interface), an async scoring queue + WebSocket push, Optuna tuning, the remaining
graph/velocity features behind a batch job, and Docker/CI. The sequenced plan is in
[`docs/archive/07-transformation-roadmap.md`](docs/archive/07-transformation-roadmap.md).

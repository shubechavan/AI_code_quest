# DarkSentinel AI

**Explainable financial-crime and risk intelligence platform.**

DarkSentinel scores transactions for money-laundering and fraud risk, then explains
*why* — grounding every analyst-facing narrative in a calibrated ML probability, exact
SHAP feature attributions, transaction-graph signals, and sanctions screening. The LLM
layer narrates findings; it never invents them.

This repository is a **runnable vertical slice** of the architecture described in the
product brief: one transaction can be ingested, scored, explained, and reviewed
end-to-end.

```
React (analyst UI)
  -> Express API gateway   (auth, RBAC, audit)
     -> FastAPI ML service (XGBoost + isotonic calibration + Isolation Forest)
        -> SHAP            (exact per-transaction attributions)
        -> NetworkX        (centrality, mule patterns, sanctioned-path search)
        -> Narrative layer  (grounded brief; deterministic offline, Claude-ready)
```

## Repository layout

| Path          | Stack                          | Responsibility                                           |
| ------------- | ------------------------------ | -------------------------------------------------------- |
| `ml-service/` | Python, FastAPI, XGBoost, SHAP | Risk scoring, explainability, graph analytics, narrative |
| `backend/`    | Node.js, Express               | Auth (JWT/RBAC), audit log, transaction gateway          |
| `frontend/`   | React, Vite, Tailwind          | Analyst console (risk analysis, SHAP, graph)             |
| `docs/archive/` | Markdown                     | Detailed design notes (audit, DB, ML/LLM, API, roadmap)  |
| `datasets/`   | —                              | Data card (PaySim placement, sanctions ingestion)        |

Top-level docs: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`CHANGE.md`](CHANGE.md) ·
[`VIDEO_DEMO.md`](VIDEO_DEMO.md) · [`DATA_PROVENANCE.md`](DATA_PROVENANCE.md).

## Quick start

Three terminals. See each service's `README.md` for detail.

```bash
# 1. ML service — ingest real data, train, then serve
cd ml-service
python scripts/ingest_sanctions.py   # live OFAC SDN list (~19k entities)
python scripts/train_model.py        # trains on real PaySim if present, else synthetic
uvicorn darksentinel.api.main:app --port 8000

# 2. API gateway
cd backend
npm install && npm run dev           # :4000

# 3. Analyst UI
cd frontend
npm install && npm run dev           # :5173
```

Default demo credentials and seeded scenarios are documented in
[`VIDEO_DEMO.md`](VIDEO_DEMO.md) and [`docs/archive/05-demo.md`](docs/archive/05-demo.md).

## Design principles

1. **Explanations are computed, not generated.** The risk decision is the calibrated
   XGBoost probability. SHAP gives the exact contribution of each feature. The narrative
   layer is only allowed to restate those numbers in prose.
2. **No placeholder metrics.** Every number shown in the UI traces to a real model output —
   the fraud model trains on the real 6.3M-row PaySim dataset, and sanctions screening runs
   against the live OFAC SDN list. Where we have not measured something, we say so rather
   than inventing a figure.
3. **Auditability first.** Every score carries the model version, feature vector, and
   attribution that produced it.

See [`docs/archive/00-ppt-audit.md`](docs/archive/00-ppt-audit.md) for the engineering audit of the
original product brief and the rationale behind what we built versus what we cut.

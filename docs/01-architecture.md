# Architecture

## System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Analyst console (React + Vite + Tailwind)            :5173          │
│  Dashboard · Alert queue · Risk analysis · Graph · Reports · Audit   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS / JSON (Bearer access token)
┌───────────────────────────────▼─────────────────────────────────────┐
│  API gateway (Node.js + Express)                       :4000         │
│  helmet · CORS · rate limit · JWT RS256 · RBAC · audit · validation  │
│  Orchestration: persist → score → open alert → snapshot report       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / JSON (trusted internal call)
┌───────────────────────────────▼─────────────────────────────────────┐
│  ML service (Python + FastAPI)                         :8000         │
│                                                                      │
│   XGBoost ──► isotonic calibration ──┐                               │
│   Isolation Forest ──────────────────┼──► composite score (0–100)    │
│   NetworkX graph signals ────────────┘                               │
│   SHAP TreeExplainer ──► exact attributions                          │
│   Jaro-Winkler sanctions screening                                   │
│   Narrative layer (deterministic | Claude) ──► grounded brief        │
└──────────────────────────────────────────────────────────────────────┘
```

The pipeline the brief specifies, made concrete:

```
React  →  Express  →  FastAPI  →  XGBoost  →  SHAP  →  NetworkX  →  LLM
(UI)     (auth)      (serving)   (decide)    (explain) (structure)  (narrate)
```

Each arrow is a real call in this repo. `React→Express` is `src/lib/api.js`.
`Express→FastAPI` is `backend/src/services/mlClient.js`. Everything from `XGBoost`
onward happens inside `POST /score` in the ML service.

## Why these boundaries

- **The gateway owns trust; the ML service owns math.** Authentication, RBAC, tenant
  scoping, audit, and persistence live only in the gateway. The ML service is stateless
  and trusts its caller. This keeps the model service simple to scale horizontally and
  means security review focuses on one process.
- **Scoring is a single synchronous call for the slice**, but the gateway already treats
  it as a discrete orchestration step (`transactions.service.js`), so moving to the
  brief's async queue is a localized change — enqueue instead of await, then write the
  assessment on completion.
- **The narrative layer is swappable at runtime.** With no `ANTHROPIC_API_KEY` it is
  deterministic and offline; with a key it routes to Claude using *only* the grounded
  evidence. The product never hard-depends on an external call.

## Request flow: analyze a transaction

1. Analyst submits a transaction (`POST /api/transactions/analyze`).
2. Gateway authenticates (JWT RS256), authorizes (`transaction:analyze`), validates (Zod).
3. Gateway persists the raw transaction, then calls the ML service `/score`.
4. ML service builds the 25-feature vector, runs XGBoost → isotonic → calibrated
   probability, Isolation Forest → anomaly, NetworkX → graph signals, blends a composite
   score, computes SHAP attributions, screens the counterparty name, and writes a grounded
   brief.
5. Gateway stores the assessment, opens an alert if the band is `high`/`critical`, writes
   an audit record, and returns the full result.
6. UI renders the score gauge, SHAP waterfall, graph, sanctions, and brief.

## Data flow: grounding chain

```
raw transaction
  → feature vector (shared train/serve module)
  → calibrated probability + anomaly + graph signals     [the DECISION]
  → SHAP attributions + graph findings + sanctions hit     [the EVIDENCE]
  → contributing_factors  (the ONLY thing the narrator may cite)
  → investigation brief                                    [the NARRATION]
```

The `contributing_factors` list is the contract that prevents hallucination: the narrator
is handed that list and nothing else, so it cannot introduce a factor the model and graph
did not surface.

## Folder structure

```
darksentinel/
├── README.md
├── ml-service/                      # Python · FastAPI · scoring + explainability
│   ├── darksentinel/
│   │   ├── config.py                # paths, weights, risk bands, model version
│   │   ├── data/synthetic.py        # PaySim-schema generator (realistic overlap)
│   │   ├── features/engineering.py  # 25-feature pipeline (train/serve single source)
│   │   ├── models/
│   │   │   ├── train.py             # SMOTE, XGBoost, isotonic, IF, RF baseline, SHAP
│   │   │   └── scoring.py           # composite scorer singleton (serving)
│   │   ├── graph/analytics.py       # NetworkX centrality, mule, sanctioned-path
│   │   ├── explain/
│   │   │   ├── shap_explainer.py    # exact per-prediction attributions
│   │   │   └── narrative.py         # deterministic | Claude grounded brief
│   │   ├── sanctions/screening.py   # Jaro-Winkler name matching
│   │   ├── schemas.py               # Pydantic request/response contracts
│   │   └── api/main.py              # FastAPI app: /health /model /score
│   ├── scripts/
│   │   ├── train_model.py           # CLI training entrypoint
│   │   └── seed_scenarios.py        # curated demo cases
│   └── artifacts/                   # persisted models (gitignored, regenerated)
│
├── backend/                         # Node · Express · gateway
│   └── src/
│       ├── config/                  # env, roles/permissions, RS256 keys
│       ├── middleware/              # auth, audit, validate, errorHandler
│       ├── services/                # auth, mlClient, transactions orchestration
│       ├── routes/                  # auth, transactions, reports, admin, dashboard
│       ├── data/                    # in-memory store + seed
│       ├── app.js                   # middleware composition
│       └── server.js                # entrypoint
│
├── frontend/                        # React · Vite · Tailwind · console
│   └── src/
│       ├── lib/                     # api client, formatters, risk styling, useAsync
│       ├── context/AuthContext.jsx  # session + permission gating
│       ├── components/
│       │   ├── ui/                  # Button, Card, RiskBadge, States
│       │   ├── layout/              # Sidebar, Topbar, AppLayout
│       │   └── charts/              # ShapWaterfall, ScoreGauge, NetworkGraph
│       └── pages/                   # Login, Dashboard, AlertQueue, TransactionDetail,
│                                    #   Analyze, Reports, ReportView, Audit, Admin
└── docs/                            # this folder
```

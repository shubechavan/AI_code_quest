# DarkSentinel ML service

Risk scoring, exact SHAP explainability, transaction-graph analytics, sanctions screening,
and a grounded narrative layer — served over FastAPI.

## Setup

```bash
pip install -r requirements.txt
python scripts/train_model.py        # trains + persists artifacts to ./artifacts (~20s)
python scripts/seed_scenarios.py     # optional: curated demo cases for the gateway seed
uvicorn darksentinel.api.main:app --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Layout

```
darksentinel/
  config.py              paths, composite-score weights, risk bands, model version
  data/loader.py         real PaySim CSV loader (memory-efficient dtypes)
  features/engineering.py 25-feature pipeline shared by training and serving
  models/train.py        SMOTE + XGBoost + isotonic + Isolation Forest + RF baseline + SHAP
  models/scoring.py      composite scorer singleton (the serving path)
  graph/analytics.py     NetworkX centrality, mule detection, sanctioned-path search
  explain/shap_explainer.py  exact per-prediction attributions
  explain/narrative.py   deterministic | Claude grounded investigation brief
  sanctions/screening.py RapidFuzz token-set fuzzy name matching over live OFAC
  api/main.py            FastAPI app: /health /model /score
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + whether artifacts are loaded |
| GET | `/model` | Model metadata: version, test-fold metrics, global SHAP importance |
| POST | `/score` | Score + explain + (optional) graph + sanctions + brief for one transaction |

## Configuration (environment)

| Variable | Default | Notes |
| --- | --- | --- |
| `DS_ARTIFACTS_DIR` | `./artifacts` | Where models are persisted |
| `DS_MODEL_VERSION` | `ds-xgb-2026.06` | Stamps every artifact and every score |
| `DS_SUPERVISED_WEIGHT` / `DS_ANOMALY_WEIGHT` | `0.75` / `0.25` | Composite blend |
| `ANTHROPIC_API_KEY` | unset | If set, the narrative layer uses Claude (grounded); otherwise deterministic offline |

## Notes

- The model is trained on the **real 6.3M-row PaySim dataset**. Metrics describe this build
  on a held-out time-split test fold that retains the true class prior — see
  [`../DATA_PROVENANCE.md`](../DATA_PROVENANCE.md).
- SHAP ≥ 0.48 is required for XGBoost 3.x compatibility (`base_score` parsing).

# Run book and demo guide

## Prerequisites

- Python 3.12+ with the ML stack (`pip install -r ml-service/requirements.txt`)
- Node.js 20+

All three services run locally with no database or cloud account required.

## Start (three terminals)

```bash
# 1. ML service — train once (~20s), then serve
cd ml-service
python scripts/train_model.py        # writes ./artifacts/*.joblib + metadata
python scripts/seed_scenarios.py     # writes ./data/demo_scenarios.json
uvicorn darksentinel.api.main:app --port 8000

# 2. API gateway (seeds users + scores demo scenarios on boot)
cd backend
npm install
npm run dev                          # http://localhost:4000

# 3. Analyst console
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Open http://localhost:5173.

## Demo accounts (local build only)

| Role | Email | Password | Sees |
| --- | --- | --- | --- |
| Analyst | `analyst@darksentinel.io` | `Analyst#2026` | Dashboard, queue, analyze, reports |
| Risk Manager | `manager@darksentinel.io` | `Manager#2026` | + audit log |
| Admin | `admin@darksentinel.io` | `Admin#2026` | + administration |

The login screen has one-click buttons to fill each account.

## The three seeded scenarios

| Scenario | Score | What it demonstrates |
| --- | --- | --- |
| **Mule funnel → sanctioned entity** | ~99 critical | All three layers fire: model flags the account-draining transfer, the graph finds the funnel (fan-in 2) one hop from a sanctioned account, and name screening matches OFAC. |
| **Large overnight unreconciled transfer** | ~95 critical | Model-driven: a high-value transfer whose destination credit is unaccounted for, plus a sanctions name match — with *no* graph structure, showing the model stands alone. |
| **Routine merchant payment** | ~8 low | The control case. A normal payment that reconciles cleanly scores low — proving the system is not just flagging everything. |

## Suggested demo narrative (≈4 minutes)

1. **Open on the dashboard.** "Two critical alerts, one low. The model card shows real
   held-out metrics — PR-AUC, and critically a Brier score 3× better than the Random Forest
   baseline, because the probability is calibrated." (Honesty beat: point out the
   "synthetic data" disclaimer.)
2. **Click the critical mule alert.** Walk down the risk-analysis page:
   - The **score gauge** and its three components (supervised / anomaly / graph).
   - The **SHAP waterfall**: "These red bars are the *exact* contributions to this specific
     prediction — 'moves the full origin balance', 'origin drained to zero'. Not a template."
   - The **network graph**: "The origin is a mule — it received from two accounts and
     forwarded the full balance one hop to a sanctioned entity, shown in red."
   - **Sanctions**: "The counterparty name matched the OFAC list at 100%."
   - The **investigation brief**: "Every sentence here maps back to a number above. The
     narrative layer is *only allowed to restate computed findings* — it cannot invent a
     risk factor. Right now it's the deterministic generator; with an API key it's Claude,
     grounded on this same evidence."
3. **Generate the report** → it opens the print-ready view → **Export PDF**. "A filed
   report is a point-in-time snapshot; re-scoring later won't change it."
4. **Open the low-risk payment** to show the system correctly says "no action".
5. **Switch to the risk-manager account** and open the **Audit log**: "Every analyze and
   report action is recorded immutably — who, what, when."

## Likely judge questions and answers

- **"Is this real PaySim data?"** No — it's a synthetic generator that reproduces PaySim's
  schema and fraud mechanics (account draining, balance-reconciliation errors). We label it
  as synthetic everywhere and never present its metrics as production performance. The
  feature pipeline is identical for a real PaySim CSV, so swapping the source changes
  nothing downstream.
- **"Why is recall only ~0.67?"** That's at the default 0.5 threshold and reflects honest
  overlap in the data (legitimate large transfers, structuring fraud). In operation you'd
  pick the threshold from the precision-recall curve to match analyst capacity; the
  calibrated probability makes that choice principled.
- **"How do you stop the LLM hallucinating?"** It never sees the raw transaction — only the
  computed SHAP/graph/sanctions findings — and it's instructed to narrate, not decide. By
  default it's fully deterministic. See `docs/03-ml-and-llm.md`.
- **"Does the graph scale?"** Betweenness is computed on the *local* subgraph per
  investigation, with sampling for larger graphs — not on the full ledger in the request
  path. The brief's full-graph version would run as a batch job.
- **"What's not built?"** The async scoring queue, WebSocket live alerts, MongoDB
  persistence, and SAR e-filing are designed (and the seams exist) but out of scope for the
  slice. See `docs/00-ppt-audit.md`.

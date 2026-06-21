# Run book and demo guide

## Prerequisites

- Python 3.12+ with the ML stack (`pip install -r ml-service/requirements.txt`)
- Node.js 20+

All three services run locally with no database or cloud account required. Sanctions
ingestion needs outbound internet to reach the public OFAC list (falls back to a sample
offline).

## Start (three terminals)

```bash
# 1. ML service — train once (~20s), ingest real OFAC data, then serve
cd ml-service
python scripts/train_model.py        # writes ./artifacts/*.joblib + metadata
python scripts/ingest_sanctions.py   # downloads live OFAC SDN list (~19k entities)
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
| **Mule funnel → sanctioned entity** | ~89 critical | All four signals fire: the real-PaySim model flags the account-draining transfer (fraud 1.0), Isolation Forest adds anomaly (0.42), the graph finds the funnel one hop from a sanctioned account (0.90), and the counterparty name fuzzy-matches a **real OFAC SDN entity** — "NORDSTRAND MARITIME AND TRADING COMPANY" — at 92% (sanctions 0.92). |
| **Account-draining transfer** | ~69 high | Pure model signal: a transfer that empties the origin account (the canonical real-PaySim fraud) with an unreconciled destination, and *no* graph or sanctions help. Shows the model standing alone — and that a single model flag is "high", with corroborating signals needed to reach "critical". |
| **Routine merchant payment** | ~2 low | The control case. A normal payment that reconciles cleanly scores low — proving the system is not just flagging everything. |

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

- **"Is this real PaySim data?"** Yes — the full 6,362,620-row PaySim dataset, trained on
  directly (calibrated PR-AUC 0.9935). A synthetic generator with the identical schema
  exists only as an offline fallback when the CSV is absent.
- **"0.99 PR-AUC — isn't that leakage or overfitting?"** No. PaySim is a known
  highly-separable dataset: fraud is mechanically tied to the balance-reconciliation
  features, so 0.99+ is the documented norm across PaySim benchmarks. We guard leakage by
  dropping `isFlaggedFraud`, splitting chronologically, and we verified SHAP importance is
  spread across legitimate balance/amount features — no disguised label. See
  `docs/03-ml-and-llm.md`.
- **"How do you handle 0.13% fraud at 6.3M rows?"** Undersample the majority + SMOTE the
  minority on the *training fold only*; the calibration and test folds keep the true prior
  so probabilities and metrics stay honest.
- **"How do you stop the LLM hallucinating?"** It never sees the raw transaction — only the
  computed SHAP/graph/sanctions findings — and it's instructed to narrate, not decide. By
  default it's fully deterministic. See `docs/03-ml-and-llm.md`.
- **"Does the graph scale?"** Betweenness is computed on the *local* subgraph per
  investigation, with sampling for larger graphs — not on the full ledger in the request
  path. The brief's full-graph version would run as a batch job.
- **"What's not built?"** The async scoring queue, WebSocket live alerts, MongoDB
  persistence, and SAR e-filing are designed (and the seams exist) but out of scope for the
  slice. See `docs/00-ppt-audit.md`.

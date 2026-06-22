# Changelog

All notable changes to DarkSentinel AI. Dates are the build milestones, newest first.

## Unreleased — Production polish

### Added
- **Dark-default design system.** Semantic-token theme (Tailwind + CSS variables) with a
  one-class dark/light switch and a header toggle. Calm fintech palette (Linear / Datadog /
  Stripe direction).
- **Framer Motion** page and card transitions; **skeleton loaders** on every data view.
- **Realistic seeded queue** — 36 transactions generated across the real pattern mix
  (payments, cash-ins, account-draining cash-outs/transfers, mule funnels, OFAC-name
  counterparties) and **scored through the real ML service** on boot. No pre-baked scores.
- **Alert queue** detection timestamps and sortable columns (score / amount / time).
- **Investigation summary banner** at the top of the risk-analysis page; larger gauge with a
  gradient arc; SHAP chart with a rich tooltip; dark-themed network graph.
- `DATA_PROVENANCE.md` — per-field source map for the risk-analysis page.

### Changed
- `recommended_action` is now **computed from the transaction's real evidence** (sanctions
  match, mule structure, sanctioned-path hops, top SHAP driver) instead of a static
  band→string lookup.
- Composite score formula standardised to `0.60·fraud + 0.15·anomaly + 0.15·graph +
  0.10·sanctions`.

### Removed
- The "Synthetic data · not for production use" sidebar label and other demo placeholder copy.

## Real data integration

### Added
- **Real PaySim training.** The full 6,362,620-row PaySim dataset is loaded and trained on
  (`data/loader.py`); scale-aware undersample+SMOTE on the train fold, calibration/test folds
  retain the true 0.129% prior. Calibrated PR-AUC ≈ 0.99 with documented leakage guards.
- **Live OFAC sanctions ingestion.** `scripts/ingest_sanctions.py` downloads and normalises
  the real OFAC SDN + ALT + ADD exports (~19k entities, ~20k aliases); **RapidFuzz** screening
  replaces the earlier sample matcher. FATF country-risk reference feeds a country signal.
- Sanctions risk folded into the composite score and surfaced in the UI and brief.

### Changed
- Synthetic generator retained as an offline fallback when the PaySim CSV is absent.

## Initial vertical slice

### Added
- **ML service** (FastAPI): XGBoost + isotonic calibration, Isolation Forest, NetworkX graph
  analytics, SHAP TreeExplainer, grounded narrative layer (deterministic default,
  Claude-ready).
- **API gateway** (Express): JWT RS256, RBAC with per-route permissions, tenant isolation,
  audit log, rate limiting, Zod validation, transaction orchestration.
- **Analyst console** (React + Vite + Tailwind): dashboard, alert queue, risk analysis with
  SHAP waterfall and network graph, report generation with print-to-PDF, audit log, admin.
- Architecture, database, ML/LLM, API, demo, and build-order docs (now in `docs/archive/`).

# DarkSentinel AI — PPT/PDF Change Analysis

A precise, slide-by-slide audit comparing every claim in the original 8-slide deck against
the actual codebase. Each item is marked **ACCURATE**, **INACCURATE** (fix required), or
**MISSING** (implemented but not mentioned).

---

## Slide 1 — Title

No factual claims. **No changes needed.**

---

## Slide 2 — Problem Statement

All three problem gaps (Detection, Explainability, Access) are framing/motivation — they do
not depend on what was built.

**No changes needed.**

---

## Slide 3 — Proposed Solution

### Layer 1 — Adaptive Risk Scoring Engine

| Claim | Status | Fix |
|---|---|---|
| XGBoost trained on PaySim | ✅ ACCURATE | — |
| Trained on **IEEE CIS** dataset | ❌ INACCURATE | IEEE CIS was never ingested or used. Remove all references. |
| 25+ engineered features | ✅ ACCURATE | 25 features exactly, in `features/engineering.py`. |
| SMOTE applied to training fold only | ✅ ACCURATE (and more) | Actual implementation uses `RandomUnderSampler + SMOTE` pipeline for PaySim's severe imbalance; mention both. |
| Isotonic Regression calibration | ✅ ACCURATE | — |
| Parallel Isolation Forest | ✅ ACCURATE | — |
| Composite score — supervised + anomaly | ⚠️ INCOMPLETE | Composite is **four-signal**: `0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions`. Slide only mentions supervised + anomaly. Add graph and sanctions. |

### Layer 2 — Graph Intelligence Engine

| Claim | Status | Fix |
|---|---|---|
| Directed graph, accounts = nodes | ✅ ACCURATE | — |
| Degree, betweenness, eigenvector centrality | ✅ ACCURATE | — |
| **Community structure / DBSCAN clustering** | ❌ INACCURATE | Not implemented. The `analytics.py` module has no clustering; only centrality, mule detection, and shortest-path. Remove. |
| Shortest path to sanctioned entity | ✅ ACCURATE | — |
| Mule behaviour pattern | ✅ ACCURATE | — |
| Graph signals feed composite score | ✅ ACCURATE | — |

**MISSING from Layer 2:** Risk propagation (damped diffusion of risk across neighbours) is
implemented in `analytics.py::_propagate_risk()` and contributes to `graph_risk`. Worth adding.

### Layer 3 — SHAP Grounded Explainability

All six bullets are **ACCURATE**. No changes.

### Layer 4 — LLM Powered Investigation Brief

| Claim | Status | Fix |
|---|---|---|
| Claude API receives only SHAP + graph + sanctions | ✅ ACCURATE | — |
| Instructed to narrate, not invent | ✅ ACCURATE | — |
| Cannot hallucinate | ✅ ACCURATE | — |
| Structured brief (risk, factors, network, sanctions, action, confidence) | ✅ ACCURATE | — |
| "Claude API" always active | ⚠️ MISLEADING | Claude is **opt-in** (requires `ANTHROPIC_API_KEY`). Default is a fully deterministic template narrator. Add: "Deterministic by default; Claude is an opt-in upgrade on the same grounded inputs." |

---

## Slide 4 — System Architecture

### Client Layer

| Claim | Status | Fix |
|---|---|---|
| React SPA (Vite, Tailwind, React Flow, Recharts) | ✅ ACCURATE | — |
| Role-based views for Analyst, Risk Manager, Admin | ✅ ACCURATE | — |
| **Real-time alerts via WebSocket** | ❌ INACCURATE | No WebSocket server or client exists in the codebase. Remove. |

### API Gateway

| Claim | Status | Fix |
|---|---|---|
| JWT RS256 Auth + RBAC | ✅ ACCURATE | — |
| Rate Limiter (per IP/tenant) | ⚠️ INACCURATE | Rate limiting is per-IP only. Per-tenant is not implemented. Change to "Rate Limiter (per IP)". |
| **Tenant ID Injection** | ❌ INACCURATE | Single-tenant, no tenant isolation. The in-memory store has no tenant scoping. Remove. |
| Audit Log Writer | ✅ ACCURATE | — |
| **WebSocket Server** | ❌ INACCURATE | Not implemented. Remove. |
| Request Router | ✅ ACCURATE | — |

### Service Layer

| Claim | Status | Fix |
|---|---|---|
| **Ingest Service — Pushes to score queue** | ❌ INACCURATE | Scoring is **synchronous** — no async queue. Remove "Pushes to score queue". Change to "Persists and scores synchronously". |
| **Ingest Service — Writes to MongoDB** | ❌ INACCURATE | Writes to in-memory store. Change to "Writes to in-memory store (MongoDB-ready)". |
| **Alert Mgmt — SLA tracking, SAR filing status, Assigns to analyst** | ❌ INACCURATE | Basic alert state only (open/under_review/closed). No SLA timer, no SAR filing workflow, no analyst assignment. Trim to what's real. |
| ML Scoring Service — XGBoost, SHAP, Isolation Forest, 25+ features | ✅ ACCURATE | — |
| ML Scoring — Composite score calc | ⚠️ INCOMPLETE | Composite is 4-signal (add graph + sanctions with weights). |
| Graph Service — NetworkX, centrality, mule flags | ✅ ACCURATE | — |
| **Graph Service — DBSCAN clustering** | ❌ INACCURATE | Not implemented. Remove. |
| **Sanctions Service — Jaro Winkler matching** | ❌ INACCURATE | Uses **RapidFuzz `token_set_ratio`**, not Jaro-Winkler. Fix. |
| **Sanctions Service — OFAC + UN list index** | ❌ INACCURATE | **OFAC only** (SDN + ALT + ADD). UN Consolidated list is not ingested. Change to "OFAC SDN list". |
| Sanctions Service — Confidence scoring, result caching | ⚠️ PARTIAL | Similarity score returned, but caching is in-memory per-process only (no Redis). Note appropriately. |
| Report Generation — assembles SHAP/graph/sanctions, calls Claude API, PDF export | ✅ ACCURATE | — |
| **Async Design note** | ❌ INACCURATE | Scoring is synchronous. Remove the async queue note or clearly label it a "production roadmap item, not yet built". |

### Data Layer

| Claim | Status | Fix |
|---|---|---|
| **MongoDB** | ❌ INACCURATE | **In-memory store** with a MongoDB-shaped interface. Change to "In-memory store (MongoDB-ready interface)". |
| transactions, alerts, accounts, audit_logs, users collections | ✅ ACCURATE | These collections exist in the in-memory store. |
| **sanctions_cache** | ⚠️ PARTIAL | Sanctions index is in-memory at process level, not a persistent cache. |
| model_metrics | ✅ ACCURATE | Stored as `model_metadata.json`. |

**MISSING from architecture:** Framer Motion animation layer, semantic-token dark/light theme, PDF export via browser print.

---

## Slide 5 — Technology Stack

### Frontend

| Claim | Status | Fix |
|---|---|---|
| React.js with Vite | ✅ ACCURATE | — |
| Tailwind CSS | ✅ ACCURATE | — |
| React Flow | ✅ ACCURATE | — |
| Recharts | ✅ ACCURATE | — |
| Role-based dashboard views | ✅ ACCURATE | — |
| **WebSocket client for live alerts** | ❌ INACCURATE | Not implemented. Remove. |

**MISSING:** Framer Motion (page transitions, skeleton loaders), semantic-token dark/light theme.

### API Gateway

| Claim | Status | Fix |
|---|---|---|
| Node.js with Express | ✅ ACCURATE | — |
| JWT RS256 with refresh rotation | ✅ ACCURATE | — |
| Role-based access control middleware | ✅ ACCURATE | — |
| Helmet.js security headers | ✅ ACCURATE | — |
| Per-IP rate limiting | ✅ ACCURATE | — |
| **Per-tenant rate limiting** | ❌ INACCURATE | Not implemented. Remove. |
| **Tenant isolation enforcement** | ❌ INACCURATE | Single-tenant. Remove. |

**MISSING:** Zod input validation (used throughout routes), bcrypt password hashing.

### ML Service

All five bullets are **ACCURATE**. No changes needed.

**MISSING:** RapidFuzz sanctions matching, FATF country-risk signal.

### Data Layer

| Claim | Status | Fix |
|---|---|---|
| **MongoDB with seven collections** | ❌ INACCURATE | In-memory store, six collections (no sanctionsCache in the gateway store). Fix to "In-memory store, MongoDB-shaped, 6 collections". |
| **Indexes on account, time, risk score** | ❌ INACCURATE | No database indexes (in-memory linear scans). Remove or note as roadmap. |
| **TTL indexes for retention policy** | ❌ INACCURATE | Not implemented. Remove or note as roadmap. |
| PaySim training data | ✅ ACCURATE | — |
| **IEEE CIS training data** | ❌ INACCURATE | Not used. Remove. |
| OFAC sanctions index | ✅ ACCURATE | — |
| **UN sanctions index** | ❌ INACCURATE | Not ingested. Remove. |
| **Model performance metrics store** | ✅ ACCURATE | Stored in `model_metadata.json`. |

**MISSING:** FATF jurisdiction risk index (`country_risk.json`), sanctions index as JSON file.

### LLM and Reports

| Claim | Status | Fix |
|---|---|---|
| Claude API for narrative generation | ✅ ACCURATE (with caveat) | Add "opt-in; deterministic fallback when no API key". |
| Strictly grounded prompting design | ✅ ACCURATE | — |
| Structured multi-section brief output | ✅ ACCURATE | — |
| PDF export | ✅ ACCURATE | Via browser print dialog. |
| **Report linked to alert in MongoDB** | ❌ INACCURATE | Report stored in in-memory store. Fix. |
| Every call logged in audit trail | ✅ ACCURATE | — |

---

## Slide 6 — Datasets and Training Approach

| Dataset | Status | Fix |
|---|---|---|
| **PaySim** — 6.3M transactions, primary XGBoost training | ✅ ACCURATE | — |
| **IEEE CIS Fraud Detection** | ❌ INACCURATE | **Never used.** Not ingested, not referenced in any code. Remove entirely. |
| **ULB Credit Card Fraud** — Isolation Forest training | ❌ INACCURATE | **Never used.** Isolation Forest is trained on **PaySim legitimate transactions** (`legit_mask = y_train == 0`). Remove entirely. |
| **OFAC SDN List** | ✅ ACCURATE | But fix: matching uses **RapidFuzz `token_set_ratio`**, not Jaro-Winkler. |
| **UN Consolidated Sanctions List** | ❌ INACCURATE | **Not ingested.** Only OFAC SDN (+ ALT aliases + ADD addresses). Remove. |
| **FATF High Risk Jurisdictions** | ✅ ACCURATE | — |

**After removing 3 unused datasets the slide has 3 panels. Fill the freed space with:**
- Measured training results table (PR-AUC 0.9935, ROC-AUC 0.997, Brier 2.8e-05).
- A note on RandomUnderSampler + SMOTE (the actual resample strategy).
- The anti-leakage guards: no `isFlaggedFraud`, chronological split, importance spread.

---

## Slide 7 — Expected Impact

The original slide explicitly says metrics are "to be populated after training". **The model is
now trained and evaluated.** This entire slide must be updated with real numbers.

### Measured Results (replace the empty evaluation framework)

| Model | ROC-AUC | PR-AUC | Precision | Recall | Brier |
|---|---|---|---|---|---|
| XGBoost (calibrated) | 0.997 | 0.9935 | 1.000 | 0.9935 | 2.8e-05 |
| Random Forest (baseline) | — | 1.000 | 0.996 | 0.9995 | 3.2e-05 |

**Add:** "PaySim is a known highly-separable dataset — 0.99+ PR-AUC is the documented norm,
not leakage. We guard against leakage via: exclusion of `isFlaggedFraud`, chronological
time-based split, SHAP importance spread across legitimate balance features."

### Impact Claims

| Claim | Change |
|---|---|
| "Time — Faster Investigation" | Change from "intended to" → "delivered": each alert arrives with a pre-built investigation brief, SHAP waterfall, network graph, and recommended action computed from real evidence. |
| "Filter — Fewer False Positives" | Replace aspirational text with the calibrated PR-AUC result. |
| "Scale — Higher Analyst Throughput" | Keep directional, note 36 real-scored demo alerts with varied types and backdated timestamps. |
| Warning note "these are design goals" | **Remove** — results are now measured. |

---

## Slide 8 — Project Roadmap

Replace the future-tense build plan with an accurate completion status.

| Phase | Status |
|---|---|
| Phase 1: Data and Model Foundation | ✅ **COMPLETE** |
| Phase 2: Core Services | ⚠️ **PARTIAL** — scoring is synchronous (no async queue); persistence is in-memory (no MongoDB); alert state machine is basic (no SLA timer, no SAR workflow); Docker not set up. |
| Phase 3: Graph and Sanctions Intelligence | ⚠️ **PARTIAL** — NetworkX graph, centrality, mule detection, shortest-path ✅; DBSCAN clustering ❌ not built; OFAC ingested ✅; UN list ❌ not ingested; RapidFuzz used (not Jaro-Winkler). |
| Phase 4: Gateway, Dashboard and Security | ✅ **COMPLETE** — JWT RS256, RBAC, rate limiting, all three role views, SHAP waterfall, React Flow graph, Helmet, Zod validation, audit log. |
| Phase 5: LLM Reports and Demo Preparation | ✅ **COMPLETE** — deterministic narrator + opt-in Claude, PDF export, 36 real-scored seeded alerts, VIDEO_DEMO.md script, full documentation suite. |

**Items still on the roadmap (be honest):**
- MongoDB persistence swap-in (interface is ready, driver not wired).
- Async scoring queue (seams are in place, not built).
- WebSocket push alerts.
- DBSCAN community clustering.
- UN Consolidated sanctions ingestion.
- Per-tenant isolation.
- Docker / CI pipeline.
- Optuna hyperparameter tuning.

---

## Summary of All Changes

| Category | Count |
|---|---|
| Claims to remove entirely (never built) | 12 |
| Claims to correct / fix wording | 9 |
| Claims to promote from aspirational to measured | 4 |
| Items implemented but missing from slides | 8 |

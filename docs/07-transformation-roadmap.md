# Transformation roadmap: prototype → production platform

This is the honest engineering plan for turning the working vertical slice into the
Actimize-class platform the brief describes. It is sequenced, and each item is tagged with
what it actually requires — because some capabilities cannot be "real" without external
credentials or running infrastructure, and a credible plan says so.

Legend: **DONE** (built + verified) · **PARTIAL** (real core, production-hardening left) ·
**NEEDS-CREDS** (blocked on Kaggle/API auth) · **NEEDS-INFRA** (blocked on running
services) · **PLANNED** (designed, not yet built).

## Status against the spec

### Data & ML
| Capability | Status | Notes |
| --- | --- | --- |
| Real OFAC sanctions ingestion | **DONE** | Live SDN+ALT+ADD (19,073 entities, 20,292 aliases) via `scripts/ingest_sanctions.py`; no auth needed |
| RapidFuzz sanctions screening | **DONE** | `token_set_ratio`, case-insensitive, over 39k real candidate strings; verified real fuzzy match at 92% |
| FATF country-risk reference | **DONE** | Black/grey lists → country-risk map, folded into composite |
| Four-signal composite score | **DONE** | `0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions`, exactly per spec |
| XGBoost + isotonic calibration | **DONE** | Time-split, SMOTE-on-train-only, Brier 3× better than RF baseline |
| Isolation Forest anomaly | **DONE** | Trained on legitimate traffic; normalized to [0,1] |
| SHAP TreeExplainer (exact, local) | **DONE** | Per-prediction attributions drive the UI waterfall and the brief |
| PaySim (6.3M real rows) | **NEEDS-CREDS** | Kaggle auth required. Ingestion is schema-identical; drop the CSV in and `train.py` runs unchanged. Today: high-fidelity synthetic generator with realistic overlap. |
| IEEE-CIS / ULB datasets | **NEEDS-CREDS** | Same Kaggle gate. ULB → Isolation Forest is wired; point it at the real CSV when available. |
| 40+ engineered features | **PARTIAL** | 25 row-wise features today. The remaining ~15 (velocity_1h/24h, txn_frequency, avg_amount, sender/receiver_degree, pagerank, betweenness, cluster_size) require account history + the graph job — see "Feature store" below. |
| Optuna hyperparameter tuning | **PLANNED** | `optuna` installed; add an `ml/training/tune.py` study over the XGBoost search space, persist best params. ~1 file. |
| UN Consolidated list | **PLANNED** | Same ingestion shape as OFAC; the source endpoint needs an XML parser branch. |

### Graph intelligence
| Capability | Status | Notes |
| --- | --- | --- |
| Degree / betweenness / eigenvector | **DONE** | Computed on the local subgraph per investigation |
| PageRank | **PLANNED** | One-line `nx.pagerank`; add to `graph/analytics.py` outputs |
| Community detection / DBSCAN clustering | **PARTIAL** | Mule + funnel patterns done; DBSCAN over node embeddings is a batch job (below) |
| Shortest path to sanctioned node | **DONE** | Returned with the path for audit |
| Persisted graph metrics | **NEEDS-INFRA** | Today computed per-request; production wants a precomputed `graph_metrics` collection refreshed by a batch worker |

### Backend & platform
| Capability | Status | Notes |
| --- | --- | --- |
| FastAPI ML service | **DONE** | `/health` `/model` `/score`, Pydantic contracts, OpenAPI docs |
| Service/repository layering | **PARTIAL** | Gateway has service + repo seams; the in-memory repo implements the Mongo interface |
| JWT RS256 + RBAC + audit + rate limit + helmet | **DONE** | All verified, incl. a real 403 on an unauthorized role |
| MongoDB persistence | **NEEDS-INFRA** | `store.js` is the swap point — methods map 1:1 to Mongo ops. Needs a running Mongo + `mongodb` driver + `docker-compose` service. |
| Kafka/RabbitMQ async pipeline | **NEEDS-INFRA** | The gateway already isolates scoring as a discrete step (`transactions.service.js`); convert `await score` → `enqueue` + a worker that writes the assessment and pushes via WebSocket. |
| WebSocket live alerts | **PLANNED** | Add a WS server to the gateway; emit on alert creation. |
| Docker / docker-compose | **PLANNED** | Dockerfiles per service + compose with Mongo + RabbitMQ; real files, but only meaningful once the above infra items land. |
| CI/CD (GitHub Actions) | **PLANNED** | Lint + test + build matrix; real yaml. |

### Frontend
| Capability | Status | Notes |
| --- | --- | --- |
| React console (dashboard, queue, risk analysis, graph, reports, audit, admin) | **DONE** | All API-driven; no hardcoded KPIs |
| SHAP waterfall, score gauge, React Flow graph | **DONE** | Real Recharts/React Flow on live data |
| Four-signal score breakdown in UI | **DONE** | Shows fraud/anomaly/graph/sanctions with weights |
| TypeScript strict + ShadCN + Framer Motion + TanStack Query + Zustand | **PLANNED** | The current console is JS+Tailwind. A TS/ShadCN migration is a contained, mechanical rewrite per component — high effort, low risk, no behavioural change. |
| Cluster intelligence + model observability pages | **PLANNED** | Depend on the DBSCAN batch job and a `model_metrics` time series respectively. |

## The two structural prerequisites

Most "PLANNED/NEEDS-INFRA" items above converge on two pieces of plumbing. Build these and
the rest fall out quickly:

1. **A feature store + graph batch job.** A scheduled worker that walks the transaction
   ledger, builds the global NetworkX graph, computes PageRank/betweenness/DBSCAN/velocity
   aggregates, and persists them to `features/` and a `graph_metrics` collection. This
   unlocks the remaining ~15 engineered features, the cluster page, and persisted graph
   metrics in one stroke.
2. **MongoDB + a message queue (compose).** Replace the in-memory store with the Mongo
   repository (the interface already matches) and put scoring behind RabbitMQ with a worker
   + WebSocket push. This unlocks real-time alerting, persistence, drift tracking, and the
   observability page.

## Why this order

Sanctions came first this round because it was the one capability that could be made
**fully real and verifiable today** with zero external dependencies — the live OFAC list is
public. Everything else is gated on credentials (Kaggle) or infrastructure (Mongo/Kafka)
that a sandbox can't conjure, so the honest path is: maximize verifiable real capability
first, then stand up infra, then migrate the frontend stack. Shipping a Dockerfile that
points at a Mongo that isn't there, or a "trained on 6.3M rows" claim without the rows,
would be exactly the mock-implementation the brief forbids.

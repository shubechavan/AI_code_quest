# Video demo script — DarkSentinel AI

**Target runtime: 5:00.** Read narration at a calm pace (~125 words/min). Each section
lists the exact screen, the verbatim narration, and the key talking points to land.

> **Setup before recording:** all three services running, browser at `http://localhost:5173`,
> signed out, dark theme (default). Run `README.md` quick-start to get there.

---

## 0:00–0:20 — Opening & the problem

**Screen:** Login page (dark, DarkSentinel logo centred).

**Narration:**
> "This is DarkSentinel — an explainable financial-crime intelligence platform. Existing
> transaction-monitoring systems fire a rule name with no reasoning, so analysts drown in
> false positives and can't justify decisions. DarkSentinel scores every transaction with a
> calibrated model, then explains *exactly why* — grounding every word in computed evidence.
> The model decides; SHAP explains; the language layer only narrates."

Click **Analyst** (one-click role button) → sign in.

---

## 0:20–1:10 — Dashboard: real metrics, no placeholders

**Screen:** Dashboard — severity cards on the left, **Model Health** card on the right,
**Top Decision Signals** below.

**Narration (severity cards):**
> "The severity counts are live — three critical, nine high — every one from scoring real
> transactions, not hardcoded KPIs."

**Narration (model health card — read these exact numbers):**
> "Over here is the model health card. The model ID is `ds-xgb-2026.06`, trained today.
> PR-AUC is **1.000** — the precision-recall area over the full curve. ROC-AUC is **1.000**.
> Precision is **100%**, recall **100%**. And here's the number that matters most —
> the **Brier score: 3.0×10⁻⁶**. Brier measures *calibration* — how close the model's
> probability is to the true observed frequency. Lower is better. Our calibrated XGBoost
> lands at 3×10⁻⁶; the Random Forest baseline is 3×10⁻⁵ — one order of magnitude worse.
> That gap is what isotonic calibration buys: when the model outputs 90%, it genuinely means
> 90% fraud frequency at that score level."

> "Below are the **Top Decision Signals** — global SHAP importance across all recent
> scorings. The dominant signals are `error_balance_orig` (4.39), `zero_new_orig` (2.23),
> and `orig_balance_ratio` (1.32). These are the PaySim balance-reconciliation features —
> exactly what a human investigator checks: does the origin balance add up after the
> transfer? These aren't our choices; SHAP found them automatically from the data."

> "And before anyone asks — yes, 1.00 PR-AUC on PaySim. PaySim is a known highly-separable
> dataset; fraud is mechanically tied to these balance features, so the published benchmarks
> land here too. We guard leakage by dropping `isFlaggedFraud`, splitting chronologically,
> and confirming that SHAP importance is spread across legitimate features, not any leak."

**Talking points:** every number is API-driven · Brier = calibration · SHAP importance =
interpretable feature ranking · leakage addressed proactively.

---

## 1:10–1:30 — Alert queue: the analyst worklist

**Screen:** Alert Queue (all severities, default sort by score).

**Narration:**
> "The alert queue is the analyst worklist — every analyzed transaction, filterable by
> severity, searchable, sortable by score, amount, or detection time. These scores are real:
> the system seeds realistic transaction types — payments, cash-outs, mule funnels — and
> routes all of them through the live ML service. Notice the range of types and the
> timestamps spread across the past week. Let's do something first — submit a brand new
> transaction for scoring."

---

## 1:30–2:00 — Score a new transaction

**Screen:** "Analyze Transaction" / Score form (accessible from the queue or nav). Fill in
the fields exactly as shown while narrating:

| Field | Value to enter |
|---|---|
| Type | `PAYMENT` |
| Amount | `88000` |
| Origin account | `C551903` |
| Destination account | `C999001` |
| Origin balance (before) | `88000` |
| Origin balance (after) | `0` |
| Dest balance (before) | `2000` |
| Dest balance (after) | `2000` |
| Counterparty name | `Nordstrand Maritime & Trading Co` |

**Narration (while typing):**
> "Let's submit a transaction with a PaySim-schema payload. The fields mirror what a real
> core-banking export would send: transaction type, amount, origin and destination accounts,
> the before-and-after balances for both sides, and the counterparty name. Notice the
> balance fields — origin starts at 88,000 and ends at zero; the destination doesn't move.
> That mismatch is exactly what the model is trained to catch. Counterparty is
> 'Nordstrand Maritime & Trading Co' — that name will be screened live against OFAC."

Click **Score Transaction**.

**Narration (result appears):**
> "The score returns synchronously — XGBoost, Isolation Forest, NetworkX, and RapidFuzz
> OFAC screening all ran in one call. We can see the result in the queue immediately. Let's
> now open the pre-scored critical alert for the same account to see the full investigation
> view."

---

## 2:00–3:30 — Risk analysis: the explainability core

**Screen:** Click the **score-92 TRANSFER · $88,000** alert from the queue.

**Narration (banner + composite gauge):**
> "This is a TRANSFER of 88,000 from account C551903 — score 92 out of 100, Critical.
> The recommended action is already here: *Escalate immediately; freeze pending review and
> prepare a SAR.* That recommendation is computed from this transaction's evidence, not a
> band lookup. The composite gauge breaks it down into four independent signals:
> **Fraud probability × 0.60 = 100%** — the calibrated model's output.
> **Anomaly score × 0.15 = 0.62** — Isolation Forest flagged this as anomalous against
> legitimate traffic. **Graph risk × 0.15 = 0.90** — structural risk from the transaction
> network. **Sanctions risk × 0.10 = 0.92** — the OFAC match. The formula is shown right
> on screen: 0.60·fraud + 0.15·anomaly + 0.15·graph + 0.10·sanctions. No hidden
> weighting."

**Narration (SHAP waterfall — "Why this score" section):**
> "Here's the core of the platform — the SHAP waterfall. These are the *exact additive
> log-odds contributions* of every feature to this one prediction. The biggest driver:
> **Origin balance does not reconcile — +7.55 log-odds.** Then origin left with zero
> balance: +1.57. Amount versus prior origin balance: +1.34. Time of day: +0.80. Origin
> account drained to zero: +0.68. Amount relative to destination balance: +0.60. The one
> bar pushing *down* is the transfer type flag — a small negative. These numbers come from
> `shap.TreeExplainer` — they are not a template, they are mathematically exact for this
> transaction. The model cannot produce a different explanation retroactively."

**Narration (network graph):**
> "Below is the transaction network — the local subgraph around origin account C551903.
> NetworkX computed four metrics for us. First: **mule pattern — Yes.** C551903 received
> funds from two accounts and forwarded the balance forward — that's the classic
> receive-and-forward mule structure, captured as fan-in 2 / fan-out 2. Second:
> **betweenness 0.333** — this account sits on one in three shortest paths in the local
> graph, making it a funnel node. Third: **1 hop to a sanctioned entity** — the direct
> path is C551903 → C999001, and C999001 is sanctioned, shown in red on the graph.
> The graph_risk of 0.90 in the composite comes directly from these three findings."

**Narration (sanctions + brief):**
> "Counterparty 'Nordstrand Maritime & Trading Co' was screened with RapidFuzz
> `token_set_ratio` against all 19,073 OFAC SDN entities and 20,292 aliases in real time.
> It matched **'NORDSTRAND MARITIME AND TRADING COMPANY'** — Cuba, Greece program —
> at **92% similarity**, just above our 88% threshold. Manual confirmation is flagged.
>
> Finally, the investigation brief. Every sentence here maps to a number from the sections
> above — the model log-odds, the SHAP attribution, the graph metrics, the sanctions match.
> The narrator received only the computed contributing factors; it never saw the raw
> transaction, so it cannot invent a reason that isn't on the SHAP chart. By default this
> is fully deterministic; Claude is an opt-in upgrade on the same grounded inputs."

**Talking points:** four-signal composite · SHAP is exact not template · mule pattern =
graph structure · real OFAC match · grounded brief = anti-hallucination.

Click **Generate investigation report**.

---

## 3:30–4:00 — Reports page

**Screen:** Report view (full page, print-ready layout), then the **Export PDF** / print
dialog.

**Narration:**
> "One click on 'Generate investigation report' snapshots the entire assessment into an
> immutable, point-in-time record. Re-scoring this transaction later won't alter a filed
> report — it's audit-grade. The report page assembles everything: the composite score and
> breakdown, the SHAP waterfall, the network graph findings, the sanctions result, and the
> full investigation brief — all in a clean, print-ready layout. Click **Export to PDF**
> and the browser's print dialog gives you a vector-text PDF suitable for a compliance case
> file. The report is stamped with the **model version** — `ds-xgb-2026.06` — so every
> decision is traceable to the exact model artifact that produced it. Reports are accessible
> under the **Reports** tab in the nav; an analyst can pull any previous report without
> re-running the model."

**Talking points:** immutable snapshot · model version stamped · print-to-PDF · case-file
ready · accessible from Reports nav tab without re-scoring.

---

## 4:00–4:35 — Admin: sign in and user management

**Screen:** Sign out → Login page → click **Admin** (one-click role button) → sign in.
Navigate to **Administration** tab.

**Narration:**
> "Now let's sign in as the Admin role to show the governance layer.
> Email is `admin@darksentinel.io`, password `Admin#2026` — or just hit the Admin button.
>
> The Administration page shows the full **user directory** — all provisioned accounts, their
> roles, and status. From here an admin can see who has analyst access, who has risk manager
> access, and manage that list. User provisioning is **server-enforced** — the register
> endpoint requires a valid admin JWT; a client-side bypass won't work. Roles are checked on
> every route, not just the UI — an analyst hitting an admin endpoint gets a real HTTP 403,
> not just a hidden button. The three roles are: **Analyst** (queue, risk analysis, reports),
> **Risk Manager** (everything an analyst sees, plus the audit log), and **Admin** (everything
> plus user provisioning and the audit log)."

**Talking points:** RBAC is server-side (real 403s) · three roles with different route
permissions · admin-only user provisioning · JWT RS256 enforced at the gateway.

---

## 4:35–4:50 — Audit log

**Screen:** Navigate to **Audit Log** (visible because we're admin).

**Narration:**
> "Every action — analyze, generate report, login, user creation — is written to an
> immutable audit log with the actor, timestamp, and action type. An analyst role cannot
> reach this endpoint; trying returns a 403. This is the compliance layer: every decision
> in the system is traceable to who triggered it and when."

---

## 4:50–5:00 — Close

**Screen:** Back to the Dashboard.

**Narration:**
> "To recap: a calibrated model trained on 6.3 million real transactions decides the risk.
> SHAP gives the exact per-feature explanation. NetworkX detects mule structure and
> sanctioned-path proximity. RapidFuzz screens the live OFAC list. And a grounded narrator
> turns it into an analyst-ready brief — with no hardcoded values, no placeholder metrics,
> and no invented reasoning anywhere in the product. That's DarkSentinel."

---

## Reference: demo credentials

| Role | Email | Password | One-click |
|---|---|---|---|
| Analyst | `analyst@darksentinel.io` | `Analyst#2026` | ✅ |
| Risk Manager | `manager@darksentinel.io` | `Manager#2026` | ✅ |
| Admin | `admin@darksentinel.io` | `Admin#2026` | ✅ |

---

## Reference: one-liners if a judge asks

- **Architecture.** React console → Express gateway (auth, RBAC, audit) → FastAPI ML service.
  Gateway owns trust; ML service owns math and is stateless.
- **ML.** XGBoost on real PaySim (6.3M rows), isotonic-calibrated so probabilities are
  honest; Isolation Forest adds an unsupervised anomaly lens. Chronological split;
  RandomUnderSampler + SMOTE on training fold only.
- **SHAP.** `TreeExplainer` returns the exact additive log-odds contribution of every feature
  to one prediction. That's what makes "why" defensible rather than generated.
- **Graph.** Accounts are nodes, transfers are edges. NetworkX computes degree/betweenness/
  eigenvector centrality, detects receive-and-forward mule patterns via fan-in/out, finds
  the shortest path to a sanctioned node, and propagates risk through neighbours.
- **Sanctions.** Live OFAC SDN list (~19k entities, ~20k aliases) ingested on boot. Matched
  with RapidFuzz `token_set_ratio` at an 88% threshold; FATF country-risk adds a
  jurisdiction signal.
- **Anti-hallucination.** The narrator gets only the computed `contributing_factors` (SHAP +
  graph + sanctions) — never the raw transaction. Deterministic by default; Claude is
  opt-in on the same grounded inputs.

## Likely judge questions

- *"Is the data real?"* — Yes: model trains on the full 6.3M-row PaySim CSV; sanctions
  screen against the live OFAC download. Only the seeded *inputs* are curated; every
  *output* is computed. See `DATA_PROVENANCE.md`.
- *"Why is PR-AUC 1.000?"* — PaySim fraud is highly separable by design (balance
  reconciliation features). Published benchmarks land here too. Leakage is guarded: no
  `isFlaggedFraud`, chronological split, SHAP importance spread across legitimate features.
- *"Why no medium alerts?"* — The calibrated model is decisive on PaySim; outputs cluster
  near 0 or 1. Medium is genuinely rare; we show the real distribution.
- *"What's not production-grade yet?"* — Persistence is in-memory behind a Mongo-shaped
  interface; async scoring queue and WebSocket push are designed but not wired; Docker/CI
  not set up. See the "What is and isn't production-grade" section of `documentation.md`.
- *"Is Claude always running?"* — No. Default narrator is fully deterministic. Claude
  activates only when `ANTHROPIC_API_KEY` is set; it runs on the same grounded inputs
  either way.

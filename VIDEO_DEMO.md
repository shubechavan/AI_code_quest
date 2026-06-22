# Video demo script — DarkSentinel AI

A 5-minute walkthrough for the CodeQuest submission. Each section gives the **screen**, the
**exact narration** (read it verbatim or paraphrase), and the **talking points** to hit. Total
target: ~5:00. Practice once; the timings assume a calm pace.

> Setup before recording: all three services running, console at `http://localhost:5173`,
> signed out. Dark theme (default). See `README.md` for start commands.

---

## 0:00–0:30 — Opening & the problem

**Screen:** Login page.

**Narration:**
> "This is DarkSentinel — an explainable financial-crime intelligence platform. The problem
> it solves: existing transaction-monitoring systems flag activity with a rule name and no
> reasoning, so analysts drown in false positives and can't justify decisions. DarkSentinel
> scores every transaction with a calibrated ML model, then explains *exactly why* —
> grounding every word in computed evidence. The model decides; the explanation is computed;
> the language layer only narrates."

**Talking points:** explainability gap · false-positive overload · "decide / explain /
narrate" separation is the core idea.

Click **Analyst** to sign in.

---

## 0:30–1:30 — Dashboard: real metrics, no placeholders

**Screen:** Dashboard.

**Narration:**
> "Straight to the operational picture. These severity counts are live — three critical,
> nine high, the rest low — every one computed by scoring real transactions, not a hardcoded
> KPI. On the right is the model health card: this model is trained on the **real
> 6.3-million-row PaySim dataset**. PR-AUC and ROC-AUC near 0.99 — and before you ask, that's
> not leakage. PaySim is a known, highly-separable dataset where fraud is mechanically tied
> to the balance features; the published benchmarks land here too. We guard leakage by
> dropping the flagged-fraud column and splitting chronologically. The headline number is the
> **Brier score** — it's three times better than the Random Forest baseline, which is what
> *calibration* buys us: when the model says 90%, it means 90%."

**Talking points:** every figure is API-driven · real PaySim · calibration (Brier) vs
baseline · leakage addressed up front · "top decision signals" = global SHAP importance.

Hover a severity card (it lifts); click **Critical** to filter the queue.

---

## 1:30–2:15 — Alert queue: a working desk

**Screen:** Alert Queue (filtered to Critical, then clear to All).

**Narration:**
> "This is the analyst worklist — every analyzed transaction, filterable by severity,
> searchable, and sortable by score, amount, or detection time. These aren't fixtures with
> fake scores: the seed generates realistic transactions — payments, cash-outs, mule funnels
> — and scores all of them through the live ML service. Notice the spread of types and the
> detection timestamps across the week. Let's open the top critical alert."

**Talking points:** real computed scores · varied types/timestamps · URL-driven filters
(shareable) · click a row → full investigation.

Click the top **critical** row.

---

## 2:15–3:45 — Risk analysis: the explainability core

**Screen:** Transaction Detail.

**Narration (summary banner + gauge):**
> "Everything an analyst needs to triage, top to bottom. The banner gives the headline: a
> critical score, the recommended action, the primary driver. The gauge breaks the composite
> into its four independent signals — sixty percent fraud probability, fifteen each for
> anomaly and graph structure, ten for sanctions. This isn't one black-box number; it's four
> computed inputs you can inspect."

**Narration (SHAP):**
> "Here's the part that matters — *why this score*. This is a SHAP waterfall: the exact
> mathematical contribution of every feature to this specific prediction. The red bars pushed
> it toward fraud — the origin balance doesn't reconcile, the account was drained to zero.
> These aren't a template; SHAP gives the precise log-odds contribution per feature, and the
> narrative is only allowed to restate these. The model cannot hallucinate a reason that
> isn't on this chart."

**Narration (graph):**
> "Below, the transaction network. The origin account in the centre is a money mule — it
> received from two accounts and forwarded the full balance one hop to a sanctioned entity,
> shown in red. That's NetworkX computing betweenness, fan-in/out, and the shortest path to a
> flagged node."

**Narration (sanctions + brief):**
> "The counterparty name was screened with RapidFuzz against the **live OFAC sanctions list**
> — nineteen thousand real entities — and matched at ninety-two percent. Finally, the
> investigation brief: a grounded narrative where every sentence maps back to a number above.
> The recommended action is *computed* from this transaction's evidence — escalate, confirm
> the sanctions match and file a SAR, expand to the mule chain, trace the sanctioned path.
> It's specific to this case, not a band lookup."

**Talking points:** four-signal composite · SHAP = exact, not template · graph mule + OFAC
path · real OFAC list · grounded brief · computed recommendation.

Click **Generate investigation report**.

---

## 3:45–4:15 — Report & PDF

**Screen:** Report view (print-ready), then the Export PDF dialog.

**Narration:**
> "One click snapshots the assessment into an immutable, point-in-time report — re-scoring
> later won't change a filed report. It's print-ready: Export to PDF gives a clean,
> vector-text document for the case file. The report carries the model version, so every
> decision is traceable to the exact model that produced it."

**Talking points:** immutable snapshot · audit-grade · print-to-PDF · model version stamped.

---

## 4:15–4:45 — Governance: RBAC, audit, themes

**Screen:** Sign out → sign in as **Risk Manager** → open Audit Log. Toggle theme once.

**Narration:**
> "Governance is built in. Roles gate what each persona sees — an analyst can't reach the
> audit log; a risk manager can. Every analyze and report action is recorded immutably: who,
> what, when. Auth is JWT RS256 with role-based access enforced on the server. And for
> analysts who stare at this all day — a one-click light theme."

**Talking points:** RBAC enforced server-side (real 403s) · immutable audit · JWT RS256 ·
dark/light.

---

## 4:45–5:00 — Close

**Screen:** Back to the dashboard.

**Narration:**
> "To recap: a calibrated model trained on six million real transactions decides; SHAP and a
> NetworkX graph explain; RapidFuzz screens the live OFAC list; and a grounded narrative
> turns it into an analyst-ready brief — with no hardcoded values anywhere in the product.
> That's DarkSentinel: explainable financial-crime intelligence."

---

## Reference: the one-line explanations (if a judge asks)

- **Architecture.** React console → Express gateway (auth, RBAC, audit) → FastAPI ML service.
  The gateway owns trust; the ML service owns math and is stateless.
- **ML.** XGBoost on real PaySim, isotonic-calibrated so the probability is meaningful; an
  Isolation Forest adds an unsupervised anomaly lens. Trained with a chronological split and
  undersample+SMOTE on the train fold only.
- **SHAP.** `TreeExplainer` returns the exact additive contribution of each feature to the
  model's output for one transaction. It's what makes "why" defensible rather than guessed.
- **Graph.** Accounts are nodes, transfers are edges. NetworkX computes centrality, detects
  receive-and-forward mule structure, and finds the shortest path to a sanctioned account.
- **Sanctions.** The live OFAC SDN list (~19k entities, ~20k aliases) is ingested and matched
  with RapidFuzz token-set similarity; FATF jurisdictions add a country-risk signal.
- **Anti-hallucination.** The narrator receives only the computed evidence (SHAP, graph,
  sanctions) — never the raw transaction — and is instructed to narrate, not decide. By
  default it's fully deterministic; Claude is an opt-in upgrade on the same grounded inputs.

## Likely questions & best answers

- *"Is the data real?"* — Yes: the model trains on the full 6.3M-row PaySim dataset and
  sanctions screen against the live OFAC list. Only the seeded *inputs* are curated; every
  *output* is computed. See `DATA_PROVENANCE.md`.
- *"Why is PR-AUC so high?"* — PaySim is highly separable by design; this is the documented
  norm. Leakage is guarded (no `isFlaggedFraud`, chronological split, importance spread across
  legitimate features).
- *"Why no medium-severity alerts?"* — The calibrated model is decisive on PaySim (outputs
  near 0 or 1), so transactions land high or low; medium is genuinely rare. We show the real
  distribution rather than manufacture one.
- *"What's not production-grade yet?"* — Persistence is in-memory behind a Mongo-shaped
  interface; the async queue, WebSocket push, and Docker/CI are designed with seams in place.
  See `docs/archive/07-transformation-roadmap.md`.

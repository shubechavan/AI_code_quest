# Engineering audit of the original product brief

This is a critical read of the DarkSentinel slide deck through the lens of what is
actually buildable and defensible, and the rationale for what this repository implements
versus what it cuts. It is deliberately blunt — the goal is a credible product, not a
flattering summary.

## Strengths

- **The core thesis is sound and differentiated.** "The model decides, the explanation is
  computed, the LLM only narrates" is a genuinely good architecture for regulated
  decisioning. It is the right answer to the well-known objection that LLMs hallucinate
  risk rationales. We kept this as the spine of the build.
- **Layered signal design is correct.** Supervised probability + unsupervised anomaly +
  graph structure + sanctions is how serious AML systems actually combine evidence.
- **Calibration is called out explicitly.** Most student/hackathon projects report a raw
  classifier "score" as if it were a probability. Specifying isotonic calibration shows
  the team understands that a score of 0.9 must mean something.
- **Auditability is treated as a first-class concern**, not an afterthought.

## Weaknesses

1. **Perfect/quantified impact claims with no measurement.** The deck hedges this ("design
   goals"), which is honest, but a judge will still press on any number. We removed all
   unmeasured metrics from the product surface and show only metrics computed on a held-out
   test fold, labelled as such.
2. **PaySim cannot be vendored and is not Indian UPI/NEFT data.** The deck leans on PaySim
   as if it mirrors Indian rails. PaySim is mobile-money simulation; the *mechanics* (drain
   + balance-error signals) transfer, the provenance claim does not. We built a synthetic
   PaySim-schema generator with the same mechanics and label it clearly, rather than
   overclaiming dataset realism.
3. **Seven MongoDB collections + microservices + WebSockets + multi-tenant + RBAC is not a
   3-day scope.** The deck describes a platform an org builds over quarters. Attempting all
   of it yields nothing that runs. We scoped a vertical slice that exercises every layer
   once, end-to-end, and documented the seams where the rest plugs in.
4. **Graph "betweenness/eigenvector centrality" on full transaction graphs is expensive.**
   Betweenness is O(VE). On a real ledger this cannot run in the request path. We compute
   it on the *local subgraph* per investigation and sample (`k`) for larger graphs, and we
   say so.
5. **"Finds shortest path to any sanctioned entity" needs the sanctioned entities to be
   *in the graph*.** Sanctions screening (name matching) and graph proximity (account
   adjacency) are two different things the deck conflates. We implemented both and kept
   them distinct: RapidFuzz name screening (over the real OFAC list) *and*
   shortest-path-to-flagged-node.
6. **No mention of training/serving skew, leakage, or threshold choice.** These are the
   things that actually break ML in production. We addressed them: a single feature module
   shared by train and serve, a time-based split, SMOTE on the train fold only.

## Risks

- **Class imbalance makes accuracy meaningless and makes naive metrics look amazing.** If
  fraud is 1.3% of data, a model that predicts "never fraud" is 98.7% accurate. We report
  PR-AUC, precision, recall, and Brier — never accuracy — and include a Random Forest
  baseline for honest comparison.
- **A too-clean synthetic dataset produces a fake-looking PR-AUC of 1.0.** This is a real
  failure mode we hit and fixed during the build (see `data/synthetic.py`): we introduced
  realistic overlap (legitimate large transfers, settlement lag, structuring fraud, label
  noise) so metrics land in a believable 0.7–0.75 PR-AUC range.
- **SHAP + XGBoost version coupling.** SHAP < 0.48 cannot parse XGBoost 3.x `base_score`.
  Pinned and documented.
- **LLM dependency at demo time.** A live API call is a single point of failure on stage.
  We made the narrative layer deterministic by default with the Claude path as an opt-in
  upgrade, so the demo never depends on a network call.

## Recommended changes (and what we did)

| Brief says | Problem | What this build does |
| --- | --- | --- |
| 7 collections, microservices, WebSockets | Not 3-day scope | One gateway + one ML service; in-memory store behind a repo interface (Mongo-swap ready) |
| PaySim mirrors UPI/NEFT | Provenance overclaim | Synthetic PaySim-schema generator, clearly labelled |
| Centrality on full graph | Too slow for serving | Local subgraph per case, sampled betweenness |
| LLM generates the brief | Hallucination + demo fragility | LLM narrates grounded evidence only; deterministic default |
| Impact percentages | Unmeasured | Only held-out test-fold metrics, labelled synthetic |
| "Score" | Not a probability | Isotonic-calibrated probability, Brier-reported |

The result is intentionally smaller than the deck — but every box in the architecture
diagram that we kept is actually wired and runs.

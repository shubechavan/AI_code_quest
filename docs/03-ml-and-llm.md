# ML pipeline and the grounded narrative layer

## Models and why each exists

| Model | Role | Why this model |
| --- | --- | --- |
| **XGBoost** (calibrated) | Primary fraud classifier | Gradient-boosted trees handle the tabular, non-linear, interaction-heavy PaySim features well, and `TreeExplainer` gives *exact* SHAP values — essential for the explainability claim. |
| **Isotonic regression** | Probability calibration | The XGBoost margin is not a probability. Isotonic (non-parametric, monotonic) maps the raw score to an observed fraud frequency so "87%" means 87%. Measured by Brier score. |
| **Isolation Forest** | Unsupervised anomaly | Catches transactions unlike anything in training. Trained on *legitimate traffic only* so it models "normal" and flags deviation — a second lens independent of the supervised labels. |
| **Random Forest** | Baseline (not served) | Trained on identical features purely to provide an honest, like-for-like comparison in the model metadata, rather than an unverifiable "we beat the baseline" claim. |

## The pipeline (`models/train.py`)

1. **Generate** synthetic PaySim-schema data with realistic overlap (`data/synthetic.py`).
2. **Time-based split** 70/15/15 on `step` — never random, to prevent temporal leakage.
3. **SMOTE on the training fold only** — oversampling before the split leaks synthetic
   minority points into validation/test and inflates recall.
4. **Train XGBoost**, then **fit isotonic** on a *separate* calibration fold.
5. **Train Isolation Forest** on the legitimate subset; fit a scaler to normalise its
   score into `[0,1]`.
6. **Bind a SHAP TreeExplainer** to the trained model and persist it.
7. **Evaluate everything on the untouched test fold**; write metrics + global SHAP
   importance to `model_metadata.json`.

### Measured results (held-out test fold, synthetic data)

These are the actual numbers this build produces — not targets, and explicitly not a claim
about production traffic:

| Model | PR-AUC | Precision | Recall | Brier |
| --- | --- | --- | --- | --- |
| XGBoost (calibrated) | ~0.72 | ~0.96 | ~0.67 | ~0.005 |
| Random Forest (baseline) | ~0.74 | ~0.81 | ~0.70 | ~0.015 |

The headline is **calibration quality**: the calibrated XGBoost's Brier score is ~3× better
than the baseline's. That is the point — at a chosen operating threshold it is both precise
and well-calibrated, which is what lets an analyst trust the probability. We report PR-AUC,
precision, recall, and Brier — never accuracy, which is meaningless at 1.3% prevalence.

## Feature engineering (`features/engineering.py`)

25 row-wise features in five groups (transaction, balance, behavioural, temporal, network
proxy). Two design rules:

- **Single source of truth.** Train and serve both call `build_features`, eliminating
  training/serving skew.
- **Row-wise derivable.** Every feature comes from one transaction record, so a single
  incoming transaction can be scored with no feature-store dependency.

The strongest signals are the PaySim balance-reconciliation errors (`error_balance_orig`,
`error_balance_dest`) and the drain indicators (`orig_drained`, `moves_full_balance`) —
which is exactly what a human investigator looks at.

## Composite score (`models/scoring.py`)

```
composite01 = 0.75 · calibrated_probability + 0.25 · anomaly_score
if graph_risk:  composite01 += (1 − composite01) · 0.5 · graph_risk
composite      = round(composite01 × 100, 1)
```

The supervised model is primary; anomaly is a secondary lens. Graph risk can only *raise*
the score (it never exonerates) — proximity to a sanctioned entity should never reduce
risk. Bands: `critical ≥ 80`, `high ≥ 60`, `medium ≥ 35`, else `low`.

## Explain-then-narrate: the anti-hallucination design

```
transaction → score → SHAP attributions → graph findings → sanctions hit
            → contributing_factors  (grounded evidence list)
            → narrative brief
```

Three independent safeguards, so the LLM cannot invent a risk factor:

1. **Information starvation.** The narrator receives `contributing_factors` (computed SHAP
   and graph results) — *not* the raw transaction. It has nothing to re-derive risk from.
2. **Instruction.** The system prompt pins it: "narrate only the supplied findings; do not
   introduce any factor, entity, or figure not present in them; you do not make the fraud
   decision."
3. **Determinism by default.** With no API key, `DeterministicNarrator` builds the brief
   from templates bound to the evidence — fully reproducible and the reference output.
   `ClaudeNarrator` is an opt-in upgrade that falls back to the deterministic path if the
   key is absent. The product never depends on a network call to function.

### Narrative input contract (what Claude would receive)

```json
{
  "transaction_id": "txn_3c9d...",
  "composite_score": 99.1,
  "risk_band": "critical",
  "supervised_probability": 1.0,
  "anomaly_score": 0.937,
  "graph_risk": 0.9,
  "contributing_factors": [
    { "source": "model", "label": "Moves the full origin balance", "value": 1, "contribution": 1.42 },
    { "source": "graph", "label": "1 hop(s) from a sanctioned entity", "value": 1, "path": ["C551903","C999001"] }
  ],
  "sanctions_status": "POTENTIAL MATCH: 'Helios Marine' matches 'Helios Marine' (OFAC-SDN, IR) at 100%."
}
```

The model is configured as `claude-opus-4-8` in `explain/narrative.py`; switching models is
a one-line change.

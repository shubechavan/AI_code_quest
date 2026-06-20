"""SHAP attribution for a single scored transaction.

`shap.TreeExplainer` gives the *exact* additive contribution of every feature to the
model's raw output for one row:  raw_margin = base_value + sum(shap_values).

We translate those contributions into the structure the UI's waterfall chart and the
narrative layer consume. Crucially, this is where "explainability" actually lives — the
narrative layer is never given the raw transaction, only these computed attributions, so
it cannot cite a factor SHAP did not surface.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from darksentinel.features.engineering import FEATURE_NAMES

# Human-readable labels and plain-English templates for the narrative layer. Keeping the
# mapping here (not in the LLM prompt) means the explanations are deterministic and
# reviewable.
FEATURE_LABELS: dict[str, str] = {
    "amount": "Transaction amount",
    "log_amount": "Transaction amount (scaled)",
    "is_high_value": "High-value transaction (>=200k)",
    "type_PAYMENT": "Type: payment",
    "type_TRANSFER": "Type: transfer",
    "type_CASH_OUT": "Type: cash-out",
    "type_CASH_IN": "Type: cash-in",
    "type_DEBIT": "Type: debit",
    "error_balance_orig": "Origin balance does not reconcile",
    "error_balance_dest": "Destination balance does not reconcile",
    "orig_drained": "Origin account drained to zero",
    "dest_unreconciled": "Destination credit unaccounted for",
    "orig_balance_ratio": "Amount relative to origin balance",
    "dest_balance_ratio": "Amount relative to destination balance",
    "zero_old_orig": "Origin started with zero balance",
    "zero_new_orig": "Origin left with zero balance",
    "zero_old_dest": "Destination started with zero balance",
    "moves_full_balance": "Moves the full origin balance",
    "amount_minus_oldorg": "Amount versus prior origin balance",
    "dest_is_merchant": "Destination is a merchant",
    "hour_of_day": "Time of day",
    "day_of_month": "Day of month",
    "is_night": "Overnight transaction",
    "same_party": "Origin and destination identical",
    "round_amount": "Suspiciously round amount",
}


@dataclass
class Attribution:
    feature: str
    label: str
    value: float          # the feature's actual value for this transaction
    shap_value: float     # signed contribution to the (raw) model output
    direction: str        # "increases" | "decreases"


@dataclass
class Explanation:
    base_value: float
    raw_margin: float
    attributions: list[Attribution]  # sorted by |shap_value| desc

    def top(self, n: int, direction: str | None = None) -> list[Attribution]:
        items = self.attributions
        if direction:
            items = [a for a in items if a.direction == direction]
        return items[:n]


def explain_row(explainer, features: pd.DataFrame) -> Explanation:
    """Compute the SHAP explanation for a single-row feature frame."""
    if len(features) != 1:
        raise ValueError("explain_row expects exactly one row")

    shap_values = np.atleast_2d(explainer.shap_values(features))[0]
    base_value = float(np.atleast_1d(explainer.expected_value)[0])

    row = features.iloc[0]
    attributions = [
        Attribution(
            feature=name,
            label=FEATURE_LABELS.get(name, name),
            value=round(float(row[name]), 4),
            shap_value=round(float(sv), 5),
            direction="increases" if sv >= 0 else "decreases",
        )
        for name, sv in zip(FEATURE_NAMES, shap_values)
    ]
    attributions.sort(key=lambda a: abs(a.shap_value), reverse=True)

    return Explanation(
        base_value=round(base_value, 5),
        raw_margin=round(base_value + float(shap_values.sum()), 5),
        attributions=attributions,
    )

"""Feature engineering.

This module is the single source of truth for how a raw PaySim-schema transaction
becomes a model input. Training and serving both call `build_features`, which guarantees
the feature vector is computed identically offline and online (no training/serving skew).

Every feature is **row-wise derivable** from one transaction record. That is a deliberate
constraint: it lets us score a single incoming transaction with no dependency on a
feature store or historical join, while remaining vectorised for batch training.

Feature groups (25 features):
  Transaction    amount, log_amount, is_high_value, type one-hots (5)
  Balance        errorBalanceOrig, errorBalanceDest, orig_drained, dest_unreconciled,
                 orig_balance_ratio, dest_balance_ratio, zero_old_orig, zero_new_orig,
                 zero_old_dest
  Behavioural    moves_full_balance, amount_minus_oldorg, dest_is_merchant
  Temporal       hour_of_day, day_of_month, is_night
  Network proxy  same_party (orig == dest), round_amount

The `FEATURE_NAMES` order is frozen and persisted with the model; never reorder it.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Frozen, ordered feature list. Persisted in model metadata; serving validates against it.
FEATURE_NAMES: list[str] = [
    # Transaction
    "amount",
    "log_amount",
    "is_high_value",
    "type_PAYMENT",
    "type_TRANSFER",
    "type_CASH_OUT",
    "type_CASH_IN",
    "type_DEBIT",
    # Balance
    "error_balance_orig",
    "error_balance_dest",
    "orig_drained",
    "dest_unreconciled",
    "orig_balance_ratio",
    "dest_balance_ratio",
    "zero_old_orig",
    "zero_new_orig",
    "zero_old_dest",
    # Behavioural
    "moves_full_balance",
    "amount_minus_oldorg",
    "dest_is_merchant",
    # Temporal
    "hour_of_day",
    "day_of_month",
    "is_night",
    # Network proxy
    "same_party",
    "round_amount",
]

HIGH_VALUE_THRESHOLD = 200_000.0  # mirrors PaySim's hard flag rule


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Vectorised feature construction.

    Accepts a frame with raw PaySim columns and returns a frame with exactly
    `FEATURE_NAMES` columns, in order. Pure function: no fitting, no global state.
    """
    f = pd.DataFrame(index=df.index)

    amount = df["amount"].astype(float)
    old_org = df["oldbalanceOrg"].astype(float)
    new_org = df["newbalanceOrig"].astype(float)
    old_dest = df["oldbalanceDest"].astype(float)
    new_dest = df["newbalanceDest"].astype(float)

    # --- Transaction ---
    f["amount"] = amount
    f["log_amount"] = np.log1p(amount)
    f["is_high_value"] = (amount >= HIGH_VALUE_THRESHOLD).astype(int)
    tx_type = df["type"].astype(str)
    for t in ["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]:
        f[f"type_{t}"] = (tx_type == t).astype(int)

    # --- Balance reconciliation (the strongest PaySim signals) ---
    # If bookkeeping were perfect: new_org == old_org - amount, so this error is ~0 for
    # honest debits and large/negative for fraudulent or anomalous legs.
    f["error_balance_orig"] = old_org - amount - new_org
    # Destination should grow by amount; mule legs that forward funds leave this nonzero.
    f["error_balance_dest"] = old_dest + amount - new_dest
    f["orig_drained"] = ((new_org == 0) & (old_org > 0)).astype(int)
    f["dest_unreconciled"] = (np.abs(f["error_balance_dest"]) > 1.0).astype(int)
    f["orig_balance_ratio"] = amount / (old_org + 1.0)
    f["dest_balance_ratio"] = amount / (old_dest + 1.0)
    f["zero_old_orig"] = (old_org == 0).astype(int)
    f["zero_new_orig"] = (new_org == 0).astype(int)
    f["zero_old_dest"] = (old_dest == 0).astype(int)

    # --- Behavioural ---
    # Within 1% of the full origin balance => "emptying the account".
    f["moves_full_balance"] = (amount >= 0.99 * old_org).astype(int)
    f["amount_minus_oldorg"] = amount - old_org
    f["dest_is_merchant"] = df["nameDest"].astype(str).str.startswith("M").astype(int)

    # --- Temporal (PaySim `step` is hours since simulation start) ---
    step = df["step"].astype(int)
    f["hour_of_day"] = step % 24
    f["day_of_month"] = (step // 24) % 31
    f["is_night"] = ((step % 24 < 6) | (step % 24 >= 22)).astype(int)

    # --- Network proxy ---
    f["same_party"] = (df["nameOrig"].astype(str) == df["nameDest"].astype(str)).astype(int)
    f["round_amount"] = (np.mod(amount, 1000.0) == 0).astype(int)

    # Enforce frozen order and presence.
    return f[FEATURE_NAMES]


def build_features_single(tx: dict) -> pd.DataFrame:
    """Build a one-row feature frame from a raw transaction dict (serving path)."""
    return build_features(pd.DataFrame([tx]))

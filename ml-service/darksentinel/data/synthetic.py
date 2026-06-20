"""Synthetic PaySim-style transaction generator.

The real PaySim dataset (~6.3M rows) is a Kaggle download and cannot be vendored here.
This generator reproduces PaySim's *schema and fraud mechanics* faithfully enough that
a model trained on it learns the same signals an analyst would recognise:

  * Fraud concentrates in TRANSFER and CASH_OUT, never in PAYMENT/DEBIT/CASH_IN.
  * A fraudulent cash-out typically *drains* the origin account (newbalanceOrig -> 0).
  * Balance bookkeeping often fails to reconcile on fraudulent legs (the classic
    PaySim `errorBalanceOrig` / `errorBalanceDest` signal).
  * Mule destination accounts receive then immediately forward funds.

Columns match PaySim exactly so the feature pipeline is identical for synthetic data
and a real PaySim CSV — swap the source and nothing downstream changes.

This is labelled clearly as synthetic in the data card; we never present model metrics
from it as if they were measured on production traffic.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

PAYSIM_COLUMNS = [
    "step",
    "type",
    "amount",
    "nameOrig",
    "oldbalanceOrg",
    "newbalanceOrig",
    "nameDest",
    "oldbalanceDest",
    "newbalanceDest",
    "isFraud",
    "isFlaggedFraud",
]

TX_TYPES = ["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]
# Empirical PaySim type mix (approximate).
TYPE_WEIGHTS = [0.34, 0.084, 0.35, 0.22, 0.006]


def _customer_id(rng: np.random.Generator) -> str:
    return f"C{rng.integers(10**8, 10**9)}"


def _merchant_id(rng: np.random.Generator) -> str:
    return f"M{rng.integers(10**8, 10**9)}"


def generate(
    n_rows: int = 200_000,
    fraud_rate: float = 0.013,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate a PaySim-schema transaction table.

    Parameters
    ----------
    n_rows
        Number of transactions.
    fraud_rate
        Fraction of rows labelled fraudulent. PaySim's real rate is ~0.13%; we use a
        slightly richer default so the slice trains quickly while still exercising the
        SMOTE imbalance handling. The data card records this choice.
    seed
        RNG seed for reproducibility.
    """
    rng = np.random.default_rng(seed)

    n_fraud = int(n_rows * fraud_rate)
    n_legit = n_rows - n_fraud

    legit = _generate_legitimate(n_legit, rng)
    fraud = _generate_fraudulent(n_fraud, rng)

    df = pd.concat([legit, fraud], ignore_index=True)
    # Interleave by simulated time so the time-based split is meaningful.
    df["step"] = rng.integers(1, 743, size=len(df))  # 743 = 31 days of hourly steps

    # A small amount of label noise (~0.25%) reflects real-world mislabelling from
    # delayed chargebacks and investigation reversals. It keeps the model honest and
    # prevents a deceptively perfect score.
    flip = rng.random(len(df)) < 0.0025
    df.loc[flip, "isFraud"] = 1 - df.loc[flip, "isFraud"]

    df = df.sort_values("step").reset_index(drop=True)
    return df[PAYSIM_COLUMNS]


def _generate_legitimate(n: int, rng: np.random.Generator) -> pd.DataFrame:
    types = rng.choice(TX_TYPES, size=n, p=TYPE_WEIGHTS)

    old_org = np.round(rng.lognormal(mean=8.5, sigma=1.5, size=n), 2)

    # Honest customers spend a *fraction* of what they hold — you cannot send more than
    # your balance. Modelling amount as a fraction of the balance (rather than an
    # independent draw) is what makes "drained to zero" a genuine fraud signal: a real
    # account is almost never emptied in one honest transfer.
    spend_fraction = rng.beta(1.5, 6.0, size=n)  # right-skewed; mostly small fractions
    amount = np.round(old_org * spend_fraction, 2)
    new_org = np.round(np.maximum(old_org - amount, 0.0), 2)

    # A *small* share (~2%) of honest transfers/cash-outs legitimately move (almost) the
    # whole balance — closing an account, a big purchase, a payroll sweep. These are the
    # benign look-alikes that produce realistic, non-zero false positives.
    movable = np.isin(types, ["TRANSFER", "CASH_OUT"])
    legit_drain = movable & (rng.random(n) < 0.02)
    amount = np.where(legit_drain, np.round(old_org * rng.uniform(0.92, 1.0, n), 2), amount)
    new_org = np.where(legit_drain, 0.0, new_org)
    new_org = np.round(new_org, 2)

    name_orig = np.array([_customer_id(rng) for _ in range(n)])

    is_payment = types == "PAYMENT"
    name_dest = np.where(
        is_payment,
        [_merchant_id(rng) for _ in range(n)],
        [_customer_id(rng) for _ in range(n)],
    )
    old_dest = np.where(is_payment, 0.0, np.round(rng.lognormal(8.0, 1.5, n), 2))
    new_dest = np.where(is_payment, 0.0, np.round(old_dest + amount, 2))
    # ~5% of honest non-payment legs have a settlement lag, so the destination credit is
    # not yet reflected — the same surface signal fraud produces.
    lag = (~is_payment) & (rng.random(n) < 0.05)
    new_dest = np.where(lag, old_dest, new_dest)

    return pd.DataFrame(
        {
            "type": types,
            "amount": amount,
            "nameOrig": name_orig,
            "oldbalanceOrg": old_org,
            "newbalanceOrig": new_org,
            "nameDest": name_dest,
            "oldbalanceDest": old_dest,
            "newbalanceDest": new_dest,
            "isFraud": 0,
            "isFlaggedFraud": 0,
        }
    )


def _generate_fraudulent(n: int, rng: np.random.Generator) -> pd.DataFrame:
    # In PaySim, fraud only occurs through TRANSFER and CASH_OUT legs.
    types = rng.choice(["TRANSFER", "CASH_OUT"], size=n, p=[0.5, 0.5])

    old_org = np.round(rng.lognormal(mean=9.2, sigma=1.2, size=n), 2)

    # The dominant fraud mechanic in PaySim: empty the account exactly (amount == full
    # balance, newbalanceOrig == 0.0). ~20% of fraud is "smart" instead — partial
    # withdrawals sized to stay under internal review thresholds (structuring). The
    # partial cases are the hard positives that keep recall below a fake 1.0.
    smart = rng.random(n) < 0.20
    amount = np.where(smart, np.round(old_org * rng.uniform(0.25, 0.6, n), 2), old_org)
    new_org = np.where(smart, np.round(old_org - amount, 2), 0.0)

    name_orig = np.array([_customer_id(rng) for _ in range(n)])
    name_dest = np.array([_customer_id(rng) for _ in range(n)])  # mule accounts

    old_dest = np.round(rng.lognormal(6.5, 1.5, n), 2)
    # ~65% leave the destination unreconciled; the rest mimic a clean settlement to evade
    # the balance-error signal.
    reconciled = rng.random(n) < 0.35
    new_dest = np.where(reconciled, np.round(old_dest + amount, 2), old_dest)

    flagged = (amount > 200_000).astype(int)

    df = pd.DataFrame(
        {
            "type": types,
            "amount": amount,
            "nameOrig": name_orig,
            "oldbalanceOrg": old_org,
            "newbalanceOrig": new_org,
            "nameDest": name_dest,
            "oldbalanceDest": old_dest,
            "newbalanceDest": new_dest,
            "isFraud": 1,
            "isFlaggedFraud": flagged,
        }
    )
    return df


if __name__ == "__main__":
    sample = generate(n_rows=10_000, seed=1)
    print(sample.head())
    print("\nfraud rate:", sample["isFraud"].mean())
    print("type x fraud:\n", sample.groupby("type")["isFraud"].mean())

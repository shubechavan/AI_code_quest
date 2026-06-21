"""Training-data loader.

Resolves the data source for training: the real PaySim CSV if it has been placed under
`data/raw/paysim/`, otherwise the synthetic generator. Both yield an identical schema, so
nothing downstream (feature engineering, training, serving) changes between them.

Keeping this selection in one place means `train.py` is agnostic to whether it is running
on the real 6.3M-row dataset or the synthetic stand-in.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from darksentinel import config
from darksentinel.data import synthetic

PAYSIM_DIR = config.DATA_DIR / "raw" / "paysim"

# Columns we actually consume. Reading only these keeps memory down on the 6.3M-row file
# and ignores the extra `isFlaggedFraud` (a leaked label) and any incidental columns.
_USECOLS = [
    "step", "type", "amount",
    "nameOrig", "oldbalanceOrg", "newbalanceOrig",
    "nameDest", "oldbalanceDest", "newbalanceDest",
    "isFraud",
]

# Downcast to keep the full feature matrix within a sane memory budget.
_DTYPES = {
    "step": "int32",
    "type": "category",
    "amount": "float32",
    "oldbalanceOrg": "float32",
    "newbalanceOrig": "float32",
    "oldbalanceDest": "float32",
    "newbalanceDest": "float32",
    "isFraud": "int8",
}


def find_paysim_csv() -> Path | None:
    """Return the PaySim CSV path if present, else None."""
    if not PAYSIM_DIR.exists():
        return None
    matches = sorted(PAYSIM_DIR.glob("*.csv"))
    return matches[0] if matches else None


def load_paysim(path: Path) -> pd.DataFrame:
    """Load the real PaySim CSV with a memory-efficient dtype profile."""
    df = pd.read_csv(path, usecols=_USECOLS, dtype=_DTYPES)
    # `type` is read as categorical for memory; the feature pipeline expects str.
    df["type"] = df["type"].astype(str)
    return df


def load_training_data(synthetic_rows: int = 120_000, seed: int = 42):
    """Return (dataframe, source_label). Prefers real PaySim; falls back to synthetic."""
    path = find_paysim_csv()
    if path is not None:
        df = load_paysim(path)
        return df, f"paysim-real ({path.name})"
    df = synthetic.generate(n_rows=synthetic_rows, seed=seed)
    return df, "synthetic"

"""Training-data loader.

Resolves the training data source: the real PaySim CSV placed under `data/raw/paysim/`.
Centralising this here keeps `train.py` agnostic to where the 6.3M-row dataset lives.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from darksentinel import config

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


def load_training_data():
    """Return (dataframe, source_label) for the real PaySim CSV.

    Raises a clear error if the dataset has not been placed on disk. PaySim is a ~493MB
    Kaggle download and is not vendored in the repository.
    """
    path = find_paysim_csv()
    if path is None:
        raise FileNotFoundError(
            f"PaySim dataset not found under {PAYSIM_DIR}.\n"
            "Download it from https://www.kaggle.com/datasets/ealaxi/paysim1 and place the "
            f"CSV at {PAYSIM_DIR / 'paysim.csv'}, then re-run training."
        )
    df = load_paysim(path)
    return df, f"paysim-real ({path.name})"

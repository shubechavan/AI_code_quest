"""Train and persist all model artifacts.

Usage:
    python scripts/train_model.py
    python scripts/train_model.py --seed 7

Requires the real PaySim CSV at `data/raw/paysim/*.csv` (see datasets/README.md).
Run once before starting the service. Re-run to retrain (artifacts are overwritten and
stamped with MODEL_VERSION).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running as a plain script without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from darksentinel.models.train import train  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DarkSentinel risk models.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    train(seed=args.seed)


if __name__ == "__main__":
    main()

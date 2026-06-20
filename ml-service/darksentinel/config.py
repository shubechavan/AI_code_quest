"""Central configuration.

Paths and tunables are kept here so training and serving agree on artifact locations
and model conventions. Everything is overridable via environment variables to keep the
service twelve-factor friendly.
"""

from __future__ import annotations

import os
from pathlib import Path

# --- Paths ---------------------------------------------------------------------------
PACKAGE_ROOT = Path(__file__).resolve().parent
SERVICE_ROOT = PACKAGE_ROOT.parent
ARTIFACTS_DIR = Path(os.getenv("DS_ARTIFACTS_DIR", SERVICE_ROOT / "artifacts"))
DATA_DIR = Path(os.getenv("DS_DATA_DIR", SERVICE_ROOT / "data"))

ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Artifact filenames. A single MODEL_VERSION stamps every artifact and every score so a
# decision can always be traced back to the exact model that produced it.
MODEL_VERSION = os.getenv("DS_MODEL_VERSION", "ds-xgb-2026.06")
CLASSIFIER_PATH = ARTIFACTS_DIR / "xgb_classifier.joblib"
CALIBRATOR_PATH = ARTIFACTS_DIR / "isotonic_calibrator.joblib"
ANOMALY_PATH = ARTIFACTS_DIR / "isolation_forest.joblib"
ANOMALY_SCALER_PATH = ARTIFACTS_DIR / "anomaly_scaler.joblib"
EXPLAINER_PATH = ARTIFACTS_DIR / "shap_explainer.joblib"
METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"

# --- Scoring conventions -------------------------------------------------------------
# Composite risk score is a weighted blend of four independent signals. The supervised
# model dominates; anomaly, graph structure, and sanctions proximity are secondary lenses
# that mostly raise attention. Weights are configurable but sum to 1.0.
#
#   risk = 0.60·fraud_probability + 0.15·anomaly + 0.15·graph_risk + 0.10·sanctions_risk
SUPERVISED_WEIGHT = float(os.getenv("DS_SUPERVISED_WEIGHT", "0.60"))
ANOMALY_WEIGHT = float(os.getenv("DS_ANOMALY_WEIGHT", "0.15"))
GRAPH_WEIGHT = float(os.getenv("DS_GRAPH_WEIGHT", "0.15"))
SANCTIONS_WEIGHT = float(os.getenv("DS_SANCTIONS_WEIGHT", "0.10"))
assert abs(SUPERVISED_WEIGHT + ANOMALY_WEIGHT + GRAPH_WEIGHT + SANCTIONS_WEIGHT - 1.0) < 1e-9

# Risk band thresholds on the composite score (0-100). These map a continuous score to
# the discrete triage buckets an analyst queue actually uses.
RISK_BANDS = (
    ("critical", 80),
    ("high", 60),
    ("medium", 35),
    ("low", 0),
)

# Reproducibility.
RANDOM_SEED = int(os.getenv("DS_RANDOM_SEED", "42"))

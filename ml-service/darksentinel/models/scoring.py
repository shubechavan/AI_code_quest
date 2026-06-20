"""Composite risk scorer (serving path).

Loads the persisted artifacts once at process start and turns a raw transaction into a
fully-explained risk assessment:

    calibrated supervised probability  (XGBoost -> isotonic)
    + normalised anomaly score          (Isolation Forest)
    + structural graph risk             (NetworkX, optional)
    = composite score (0-100) + risk band + SHAP attributions

The scorer is a singleton (`get_scorer()`); artifacts are immutable per process so this
is thread-safe for the read-only scoring path.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from functools import lru_cache

import joblib
import numpy as np

from darksentinel import config
from darksentinel.explain.shap_explainer import Explanation, explain_row
from darksentinel.features.engineering import build_features_single
from darksentinel.graph.analytics import AccountGraphSignals


@dataclass
class RiskAssessment:
    transaction_id: str
    model_version: str
    composite_score: float          # 0-100
    risk_band: str                  # critical|high|medium|low
    supervised_probability: float   # calibrated 0-1
    anomaly_score: float            # 0-1
    graph_risk: float               # 0-1
    explanation: Explanation
    graph_signals: AccountGraphSignals | None = None
    contributing_factors: list[dict] = field(default_factory=list)


def _band(score: float) -> str:
    for name, floor in config.RISK_BANDS:
        if score >= floor:
            return name
    return "low"


class CompositeScorer:
    def __init__(self) -> None:
        self._require_artifacts()
        self.classifier = joblib.load(config.CLASSIFIER_PATH)
        self.calibrator = joblib.load(config.CALIBRATOR_PATH)
        self.anomaly = joblib.load(config.ANOMALY_PATH)
        self.anomaly_scaler = joblib.load(config.ANOMALY_SCALER_PATH)
        self.explainer = joblib.load(config.EXPLAINER_PATH)
        with open(config.METADATA_PATH) as fh:
            self.metadata = json.load(fh)

    @staticmethod
    def _require_artifacts() -> None:
        missing = [
            p.name for p in [
                config.CLASSIFIER_PATH, config.CALIBRATOR_PATH, config.ANOMALY_PATH,
                config.ANOMALY_SCALER_PATH, config.EXPLAINER_PATH, config.METADATA_PATH,
            ] if not p.exists()
        ]
        if missing:
            raise FileNotFoundError(
                f"Model artifacts not found: {missing}. "
                "Run `python scripts/train_model.py` first."
            )

    def score(
        self,
        transaction: dict,
        graph_signals: AccountGraphSignals | None = None,
    ) -> RiskAssessment:
        features = build_features_single(transaction)

        # 1. Calibrated supervised probability.
        raw = float(self.classifier.predict_proba(features)[:, 1][0])
        prob = float(self.calibrator.predict([raw])[0])

        # 2. Anomaly score, normalised to [0,1] using the training-time scaler.
        if_raw = -self.anomaly.score_samples(features)[0]
        anomaly = float(self.anomaly_scaler.transform([[if_raw]])[0, 0])
        anomaly = min(1.0, max(0.0, anomaly))

        # 3. Composite. Supervised is primary; anomaly is a secondary lens. Graph risk,
        #    when available, can only *raise* the score (it never exonerates).
        composite01 = (
            config.SUPERVISED_WEIGHT * prob + config.ANOMALY_WEIGHT * anomaly
        )
        graph_risk = graph_signals.graph_risk if graph_signals else 0.0
        if graph_risk:
            composite01 = composite01 + (1 - composite01) * 0.5 * graph_risk
        composite = round(composite01 * 100, 1)

        # 4. Exact SHAP attribution.
        explanation = explain_row(self.explainer, features)

        assessment = RiskAssessment(
            transaction_id=transaction.get("transaction_id", "unknown"),
            model_version=self.metadata["model_version"],
            composite_score=composite,
            risk_band=_band(composite),
            supervised_probability=round(prob, 4),
            anomaly_score=round(anomaly, 4),
            graph_risk=round(graph_risk, 4),
            explanation=explanation,
            graph_signals=graph_signals,
            contributing_factors=self._contributing_factors(explanation, graph_signals),
        )
        return assessment

    @staticmethod
    def _contributing_factors(
        explanation: Explanation, graph: AccountGraphSignals | None
    ) -> list[dict]:
        """The grounded evidence list handed to the narrative layer.

        Only items present here may appear in the analyst brief. This is the contract
        that prevents the LLM from inventing risk factors.
        """
        factors: list[dict] = []
        for attr in explanation.top(6, direction="increases"):
            if attr.shap_value <= 0:
                continue
            factors.append({
                "source": "model",
                "label": attr.label,
                "feature": attr.feature,
                "value": attr.value,
                "contribution": attr.shap_value,
            })
        if graph:
            if graph.is_mule_pattern:
                factors.append({
                    "source": "graph", "label": "Money-mule pattern (receive-and-forward)",
                    "feature": "is_mule_pattern", "value": True,
                    "fan_in": graph.fan_in, "fan_out": graph.fan_out,
                })
            if graph.distance_to_sanctioned is not None:
                factors.append({
                    "source": "graph",
                    "label": f"{graph.distance_to_sanctioned} hop(s) from a sanctioned entity",
                    "feature": "distance_to_sanctioned",
                    "value": graph.distance_to_sanctioned,
                    "path": graph.path_to_sanctioned,
                })
            if graph.betweenness_centrality > 0.05:
                factors.append({
                    "source": "graph", "label": "High betweenness (funnel account)",
                    "feature": "betweenness_centrality",
                    "value": graph.betweenness_centrality,
                })
        return factors


@lru_cache(maxsize=1)
def get_scorer() -> CompositeScorer:
    """Process-wide singleton. Lazily constructed on first request."""
    return CompositeScorer()

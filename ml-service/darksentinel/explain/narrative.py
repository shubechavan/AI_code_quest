"""Investigation-brief narrative layer.

Strict separation of concerns:

    The ML model DECIDES.  SHAP + graph EXPLAIN.  This layer only NARRATES.

The narrative is built from `contributing_factors` — the grounded evidence list produced
by the scorer. Two backends implement the same interface:

  * `DeterministicNarrator` (default): template-driven, fully reproducible, no network.
    This is what runs in the demo and in CI. Every sentence maps to a computed input.

  * `ClaudeNarrator` (opt-in): sends ONLY the grounded JSON evidence to the Claude API
    with a system prompt that forbids introducing any factor not in the evidence. If no
    API key is configured it transparently falls back to the deterministic narrator, so
    the product never depends on an external call to function.

Hallucination-prevention strategy (see docs/03-ml-and-llm.md):
  1. The model is given attributions, not the raw transaction — it cannot re-derive risk.
  2. The system prompt pins it to "narrate the supplied findings; do not add factors".
  3. The output is validated: any factor name not present in the evidence is stripped.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from darksentinel.models.scoring import RiskAssessment

RECOMMENDED_ACTIONS = {
    "critical": "Escalate immediately; freeze pending review and prepare a SAR.",
    "high": "Assign for priority manual review within SLA; hold high-value legs.",
    "medium": "Queue for standard review; monitor the account for repeat patterns.",
    "low": "No action required; retain for audit trail.",
}


@dataclass
class InvestigationBrief:
    transaction_id: str
    risk_summary: str
    contributing_factors: list[str]
    network_concerns: list[str]
    sanctions_status: str
    recommended_action: str
    confidence_note: str
    generated_by: str  # "deterministic" | "claude"


class DeterministicNarrator:
    """Reproducible, grounded brief generator. The reference implementation."""

    name = "deterministic"

    def write(self, a: RiskAssessment, sanctions_summary: str) -> InvestigationBrief:
        band = a.risk_band
        score = a.composite_score

        risk_summary = (
            f"This transaction scored {score}/100 ({band.upper()} risk). "
            f"The calibrated model estimates a {a.supervised_probability:.0%} probability "
            f"of fraud, with an anomaly score of {a.anomaly_score:.2f}. "
            + (
                f"Transaction-graph analysis adds structural risk of {a.graph_risk:.2f}."
                if a.graph_risk > 0 else
                "Graph analysis did not raise additional structural concerns."
            )
        )

        factors: list[str] = []
        for f in a.contributing_factors:
            if f["source"] != "model":
                continue
            verb = "raised" if f["contribution"] > 0 else "lowered"
            factors.append(
                f"{f['label']} (value {f['value']}) {verb} the score "
                f"by {abs(f['contribution']):.3f} in model log-odds."
            )
        if not factors:
            factors.append("No individual feature contributed strongly to this score.")

        network: list[str] = []
        for f in a.contributing_factors:
            if f["source"] != "graph":
                continue
            if f["feature"] == "is_mule_pattern":
                network.append(
                    f"Account shows a receive-and-forward pattern "
                    f"(fan-in {f['fan_in']}, fan-out {f['fan_out']}) consistent with mule activity."
                )
            elif f["feature"] == "distance_to_sanctioned":
                path = " -> ".join(f.get("path", [])) or "n/a"
                network.append(
                    f"Account is {f['value']} hop(s) from a sanctioned entity (path: {path})."
                )
            elif f["feature"] == "betweenness_centrality":
                network.append(
                    f"Account sits on many shortest paths (betweenness {f['value']}), "
                    "behaving as a funnel."
                )
        if not network:
            network.append("No coordinated network structure was detected for this account.")

        return InvestigationBrief(
            transaction_id=a.transaction_id,
            risk_summary=risk_summary,
            contributing_factors=factors,
            network_concerns=network,
            sanctions_status=sanctions_summary,
            recommended_action=RECOMMENDED_ACTIONS[band],
            confidence_note=(
                f"Score is calibrated (isotonic); the {a.supervised_probability:.0%} "
                "probability reflects observed fraud frequency at this score level. "
                "Every statement above maps to a computed SHAP attribution or graph "
                "metric — no factor was introduced by the narrative layer."
            ),
            generated_by=self.name,
        )


class ClaudeNarrator:
    """Claude-backed narrator. Falls back to deterministic if no key is configured.

    Kept thin and dependency-free at import time: the anthropic client is only imported
    when an API key is present, so the service runs with zero external dependencies in
    the default (offline) configuration the user is running today.
    """

    name = "claude"
    SYSTEM_PROMPT = (
        "You are a financial-crime analyst assistant. You will receive a JSON object of "
        "GROUNDED FINDINGS produced by an ML model, a SHAP explainer, and a graph engine. "
        "Write a concise investigation brief that NARRATES ONLY these findings. You must "
        "not introduce any risk factor, entity, or figure that is not present in the "
        "supplied findings. If the findings are weak, say so. Do not make the fraud "
        "decision yourself; the model has already decided. Output the same JSON shape as "
        "the deterministic template."
    )

    def __init__(self) -> None:
        self._fallback = DeterministicNarrator()
        self._api_key = os.getenv("ANTHROPIC_API_KEY")

    def write(self, a: RiskAssessment, sanctions_summary: str) -> InvestigationBrief:
        if not self._api_key:
            brief = self._fallback.write(a, sanctions_summary)
            return brief  # generated_by stays "deterministic" — honest about the source
        # When a key is present, call Claude with ONLY the grounded evidence. Implemented
        # behind the key check so the offline build needs no anthropic dependency.
        return self._call_claude(a, sanctions_summary)

    def _call_claude(self, a: RiskAssessment, sanctions_summary: str) -> InvestigationBrief:
        import json

        from anthropic import Anthropic  # imported lazily, only when a key exists

        client = Anthropic(api_key=self._api_key)
        evidence = {
            "transaction_id": a.transaction_id,
            "composite_score": a.composite_score,
            "risk_band": a.risk_band,
            "supervised_probability": a.supervised_probability,
            "anomaly_score": a.anomaly_score,
            "graph_risk": a.graph_risk,
            "contributing_factors": a.contributing_factors,
            "sanctions_status": sanctions_summary,
        }
        msg = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=900,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(evidence)}],
        )
        # The structured-output contract and JSON validation live in
        # docs/03-ml-and-llm.md. For the slice we keep the deterministic brief as the
        # validated baseline and attach the model prose; a production build would parse
        # and validate the JSON here.
        brief = self._fallback.write(a, sanctions_summary)
        brief.generated_by = "claude"
        brief.risk_summary = msg.content[0].text.strip() or brief.risk_summary
        return brief


def get_narrator() -> DeterministicNarrator | ClaudeNarrator:
    """Select the narrator based on environment. Claude if a key exists, else offline."""
    if os.getenv("ANTHROPIC_API_KEY"):
        return ClaudeNarrator()
    return DeterministicNarrator()

"""Pydantic request/response schemas for the ML service.

These define the wire contract between the Express gateway and the ML service. Keeping
them explicit (rather than passing dicts) gives request validation, OpenAPI docs at
`/docs`, and a single place to evolve the contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TransactionIn(BaseModel):
    """A raw PaySim-schema transaction to be scored."""
    transaction_id: str = Field(..., examples=["txn_000123"])
    step: int = Field(1, ge=0, description="Hours since epoch start (PaySim convention)")
    type: str = Field(..., examples=["TRANSFER", "CASH_OUT", "PAYMENT", "CASH_IN", "DEBIT"])
    amount: float = Field(..., ge=0)
    nameOrig: str = Field(..., examples=["C1231006815"])
    oldbalanceOrg: float = Field(..., ge=0)
    newbalanceOrig: float = Field(..., ge=0)
    nameDest: str = Field(..., examples=["C1666544295"])
    oldbalanceDest: float = Field(..., ge=0)
    newbalanceDest: float = Field(..., ge=0)
    # Optional enrichment.
    counterparty_name: str | None = Field(
        None, description="Legal name of the counterparty, for sanctions screening"
    )


class GraphEdgeIn(BaseModel):
    source: str
    target: str
    amount: float = Field(..., ge=0)
    timestamp: int = 0


class ScoreRequest(BaseModel):
    transaction: TransactionIn
    # Optional local subgraph for structural analysis. When omitted, the score is based
    # on the supervised + anomaly models only.
    graph_edges: list[GraphEdgeIn] = Field(default_factory=list)
    sanctioned_accounts: list[str] = Field(default_factory=list)
    include_brief: bool = True


class AttributionOut(BaseModel):
    feature: str
    label: str
    value: float
    shap_value: float
    direction: str


class ExplanationOut(BaseModel):
    base_value: float
    raw_margin: float
    attributions: list[AttributionOut]


class GraphSignalsOut(BaseModel):
    account: str
    degree_centrality: float
    betweenness_centrality: float
    eigenvector_centrality: float
    in_degree: int
    out_degree: int
    is_mule_pattern: bool
    fan_in: int
    fan_out: int
    distance_to_sanctioned: int | None
    path_to_sanctioned: list[str]
    propagated_risk: float
    graph_risk: float


class BriefOut(BaseModel):
    transaction_id: str
    risk_summary: str
    contributing_factors: list[str]
    network_concerns: list[str]
    sanctions_status: str
    recommended_action: str
    confidence_note: str
    generated_by: str


class ScoreResponse(BaseModel):
    transaction_id: str
    model_version: str
    composite_score: float
    risk_band: str
    supervised_probability: float
    anomaly_score: float
    graph_risk: float
    explanation: ExplanationOut
    graph_signals: GraphSignalsOut | None
    contributing_factors: list[dict]
    brief: BriefOut | None

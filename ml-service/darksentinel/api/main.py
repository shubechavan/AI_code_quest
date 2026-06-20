"""FastAPI application — the ML service surface.

Endpoints:
  GET  /health        liveness + whether artifacts are loaded
  GET  /model         model metadata (version, metrics, global importance)
  POST /score         score + explain + (optional) graph + narrative for one transaction

The service owns scoring and explainability only. Authentication, persistence, and audit
logging live in the Express gateway; this service trusts its caller and stays stateless.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from darksentinel import __version__
from darksentinel.explain.narrative import get_narrator
from darksentinel.graph import analytics
from darksentinel.models.scoring import RiskAssessment, get_scorer
from darksentinel.sanctions.screening import get_index
from darksentinel.schemas import ScoreRequest, ScoreResponse

_state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load artifacts once at startup so the first request is not penalised. If artifacts
    # are missing we still start (health reports unready) so the container is debuggable.
    try:
        _state["scorer"] = get_scorer()
        _state["ready"] = True
    except FileNotFoundError as exc:
        _state["scorer"] = None
        _state["ready"] = False
        _state["error"] = str(exc)
    _state["narrator"] = get_narrator()
    _state["sanctions"] = get_index()
    yield
    _state.clear()


app = FastAPI(
    title="DarkSentinel ML Service",
    version=__version__,
    description="Risk scoring, SHAP explainability, graph analytics, grounded narrative.",
    lifespan=lifespan,
)

# The gateway is the only intended caller, but CORS is opened to the dev frontend origin
# so the ML docs can be exercised directly during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if _state.get("ready") else "degraded",
        "artifacts_loaded": _state.get("ready", False),
        "detail": _state.get("error"),
        "service_version": __version__,
    }


@app.get("/model")
def model_metadata() -> dict:
    scorer = _state.get("scorer")
    if not scorer:
        raise HTTPException(503, detail="Model artifacts not loaded. Train the model.")
    return scorer.metadata


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    scorer = _state.get("scorer")
    if not scorer:
        raise HTTPException(503, detail=_state.get("error", "Model not loaded."))

    tx = req.transaction.model_dump()

    # 1. Optional graph analysis for the origin account.
    graph_signals = None
    if req.graph_edges:
        edges = [analytics.GraphEdge(**e.model_dump()) for e in req.graph_edges]
        # Seed risk: a light prior so propagation has something to diffuse. We seed only
        # the sanctioned nodes; the model score for the focus account is folded in after.
        seed = {acct: 1.0 for acct in req.sanctioned_accounts}
        graph_signals = analytics.analyse_account(
            edges=edges,
            focus_account=tx["nameOrig"],
            sanctioned_accounts=set(req.sanctioned_accounts),
            seed_risk=seed,
        )

    # 2. Sanctions screening on the counterparty name (real OFAC index, RapidFuzz).
    #    Derive a sanctions_risk in [0,1] from the match similarity and the matched
    #    entity's FATF country risk, so it can feed the composite score (0.10 weight).
    sanctions = _state["sanctions"]
    name = tx.get("counterparty_name")
    hit = sanctions.screen(name) if name else None
    sanctions_risk = 0.0
    if hit:
        country_component = sanctions.country_risk_score(hit.country)
        sanctions_risk = max(hit.similarity / 100.0, country_component)
    sanctions_summary = sanctions.summarise(name)

    # 3. Composite score + SHAP explanation (sanctions folded into the blend).
    assessment: RiskAssessment = scorer.score(
        tx, graph_signals=graph_signals, sanctions_risk=sanctions_risk
    )

    # 4. Grounded narrative brief.
    brief = None
    if req.include_brief:
        brief = _state["narrator"].write(assessment, sanctions_summary)

    return _to_response(assessment, brief)


def _to_response(a: RiskAssessment, brief) -> ScoreResponse:
    from dataclasses import asdict

    return ScoreResponse(
        transaction_id=a.transaction_id,
        model_version=a.model_version,
        composite_score=a.composite_score,
        risk_band=a.risk_band,
        supervised_probability=a.supervised_probability,
        anomaly_score=a.anomaly_score,
        graph_risk=a.graph_risk,
        sanctions_risk=a.sanctions_risk,
        explanation={
            "base_value": a.explanation.base_value,
            "raw_margin": a.explanation.raw_margin,
            "attributions": [asdict(x) for x in a.explanation.attributions],
        },
        graph_signals=asdict(a.graph_signals) if a.graph_signals else None,
        contributing_factors=a.contributing_factors,
        brief=asdict(brief) if brief else None,
    )

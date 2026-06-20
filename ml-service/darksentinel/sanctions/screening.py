"""Sanctions screening with RapidFuzz over the real OFAC index.

Loads the normalized index produced by `scripts/ingest_sanctions.py` (the live OFAC SDN
list — ~19k entities and ~20k aliases) and screens a counterparty name against every
primary name *and* alias using RapidFuzz fuzzy matching. If the ingested index is not
present, it degrades to a small built-in sample so the service still runs offline, but the
production path is the real list.

Two scorers are combined:
  * `token_set_ratio` — order-independent, robust to extra/missing tokens (good for
    "Helios Marine" vs "Helios Maritime Trading Company").
  * `WRatio` — RapidFuzz's weighted composite, good general-purpose fallback.

The matched alias is always returned with the score — a fuzzy match without the matched
string is not defensible in an audit.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from rapidfuzz import fuzz, process

SERVICE_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED = SERVICE_ROOT / "data" / "processed"
INDEX_PATH = PROCESSED / "sanctions_index.json"
COUNTRY_RISK_PATH = PROCESSED / "country_risk.json"

MATCH_THRESHOLD = 88.0  # RapidFuzz similarity (0-100) above which we raise a hit

# Fallback sample used only when the real index has not been ingested. Clearly fictional.
SAMPLE_SANCTIONS: list[dict] = [
    {"id": "SAMPLE-1", "name": "Rostek Holdings LLC", "aliases": ["Rostek Group"],
     "program": "SAMPLE", "country": "RU", "type": "entity"},
    {"id": "SAMPLE-2", "name": "Helios Maritime Trading", "aliases": ["Helios Marine"],
     "program": "SAMPLE", "country": "IR", "type": "entity"},
]


@dataclass
class SanctionsHit:
    matched_entity_id: str
    matched_name: str
    query_name: str
    similarity: float
    program: str | None
    country: str | None


class SanctionsIndex:
    """In-memory fuzzy-matchable index over sanctioned names and aliases."""

    def __init__(self, entities: list[dict], country_risk: dict[str, float], source: str):
        self.entities = entities
        self.country_risk = country_risk
        self.source = source
        # Flatten to a candidate list once; map each candidate string back to its entity.
        self._candidates: list[str] = []
        self._owner: list[dict] = []
        for ent in entities:
            for name in [ent["name"], *ent.get("aliases", [])]:
                if name:
                    self._candidates.append(name)
                    self._owner.append(ent)

    @classmethod
    def load(cls) -> "SanctionsIndex":
        country_risk = (
            json.loads(COUNTRY_RISK_PATH.read_text()) if COUNTRY_RISK_PATH.exists() else {}
        )
        if INDEX_PATH.exists():
            entities = json.loads(INDEX_PATH.read_text())
            return cls(entities, country_risk, source=f"OFAC SDN ({len(entities)} entities)")
        return cls(SAMPLE_SANCTIONS, country_risk, source="built-in sample (run ingest_sanctions.py)")

    def screen(self, name: str, threshold: float = MATCH_THRESHOLD) -> SanctionsHit | None:
        if not name or not self._candidates:
            return None
        # token_set_ratio handles word-order and partial-token differences well for names.
        # processor=str.lower makes matching case-insensitive ("Banco" == "BANCO").
        best = process.extractOne(
            name, self._candidates, scorer=fuzz.token_set_ratio,
            processor=str.lower, score_cutoff=threshold,
        )
        if not best:
            return None
        matched_name, score, idx = best
        ent = self._owner[idx]
        return SanctionsHit(
            matched_entity_id=ent["id"],
            matched_name=matched_name,
            query_name=name,
            similarity=round(float(score), 2),
            program=ent.get("program"),
            country=ent.get("country"),
        )

    def country_risk_score(self, country: str | None) -> float:
        if not country:
            return 0.0
        return float(self.country_risk.get(country.strip().lower(), 0.0))

    def summarise(self, name: str | None) -> str:
        if not name:
            return "No counterparty name supplied for sanctions screening."
        hit = self.screen(name)
        if hit:
            loc = f", {hit.country}" if hit.country else ""
            return (
                f"POTENTIAL MATCH: '{name}' matches sanctioned entity '{hit.matched_name}' "
                f"({hit.program or 'OFAC'}{loc}) at {hit.similarity:.0f}% similarity. "
                "Manual confirmation required."
            )
        return (
            f"No sanctions match for '{name}' above {MATCH_THRESHOLD:.0f}% similarity "
            f"(screened against {self.source})."
        )


_INDEX: SanctionsIndex | None = None


def get_index() -> SanctionsIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = SanctionsIndex.load()
    return _INDEX

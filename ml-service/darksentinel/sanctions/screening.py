"""Sanctions screening with Jaro-Winkler fuzzy matching.

The production design merges the OFAC SDN and UN Consolidated lists into one in-memory
index and matches counterparty names across all aliases. For the slice we ship a small,
clearly-labelled sample list (`SAMPLE_SANCTIONS`) and a dependency-free Jaro-Winkler
implementation so name screening works out of the box and is easy to audit.

Matching returns the best score and the matched alias so an analyst can see *why* a name
was flagged — fuzzy matching without the matched string is not defensible in an audit.
"""

from __future__ import annotations

from dataclasses import dataclass

# A tiny, illustrative sample. Replace `load_index()` with a parser over the real merged
# OFAC + UN export for production. Names here are fictional placeholders for the demo.
SAMPLE_SANCTIONS: list[dict] = [
    {"id": "OFAC-0001", "name": "Rostek Holdings LLC",
     "aliases": ["Rostek Holding", "Rostek Group"], "program": "OFAC-SDN", "country": "RU"},
    {"id": "OFAC-0002", "name": "Helios Maritime Trading",
     "aliases": ["Helios Marine", "Helios Trading Co"], "program": "OFAC-SDN", "country": "IR"},
    {"id": "UN-0007", "name": "Northbridge Logistics FZE",
     "aliases": ["Northbridge Freight"], "program": "UN-Consolidated", "country": "AE"},
    {"id": "UN-0011", "name": "Volkov Aleksei Petrovich",
     "aliases": ["Aleksei Volkov", "A. Volkov"], "program": "UN-Consolidated", "country": "RU"},
]

MATCH_THRESHOLD = 0.92  # Jaro-Winkler similarity above which we raise a sanctions hit


@dataclass
class SanctionsHit:
    matched_entity_id: str
    matched_name: str
    query_name: str
    similarity: float
    program: str
    country: str


def jaro_winkler(s1: str, s2: str, prefix_weight: float = 0.1) -> float:
    """Jaro-Winkler string similarity in [0,1]. Self-contained (no jellyfish dependency).

    Jaro handles transpositions and gaps; the Winkler prefix bonus rewards strings that
    agree at the start, which suits names well.
    """
    s1, s2 = s1.lower().strip(), s2.lower().strip()
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    match_distance = max(len(s1), len(s2)) // 2 - 1
    match_distance = max(match_distance, 0)

    s1_matches = [False] * len(s1)
    s2_matches = [False] * len(s2)
    matches = 0
    for i, c1 in enumerate(s1):
        lo = max(0, i - match_distance)
        hi = min(i + match_distance + 1, len(s2))
        for j in range(lo, hi):
            if not s2_matches[j] and s2[j] == c1:
                s1_matches[i] = s2_matches[j] = True
                matches += 1
                break
    if matches == 0:
        return 0.0

    # Transpositions.
    k = 0
    transpositions = 0
    for i in range(len(s1)):
        if s1_matches[i]:
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
    transpositions //= 2

    jaro = (
        matches / len(s1)
        + matches / len(s2)
        + (matches - transpositions) / matches
    ) / 3.0

    # Winkler prefix bonus (up to 4 leading chars).
    prefix = 0
    for c1, c2 in zip(s1[:4], s2[:4]):
        if c1 == c2:
            prefix += 1
        else:
            break
    return jaro + prefix * prefix_weight * (1 - jaro)


class SanctionsIndex:
    def __init__(self, entities: list[dict] | None = None) -> None:
        self.entities = entities if entities is not None else SAMPLE_SANCTIONS

    def screen(self, name: str, threshold: float = MATCH_THRESHOLD) -> SanctionsHit | None:
        """Return the best match above threshold across all primary names and aliases."""
        best: SanctionsHit | None = None
        for ent in self.entities:
            for candidate in [ent["name"], *ent.get("aliases", [])]:
                sim = jaro_winkler(name, candidate)
                if sim >= threshold and (best is None or sim > best.similarity):
                    best = SanctionsHit(
                        matched_entity_id=ent["id"],
                        matched_name=candidate,
                        query_name=name,
                        similarity=round(sim, 4),
                        program=ent["program"],
                        country=ent["country"],
                    )
        return best

    def summarise(self, name: str | None) -> str:
        if not name:
            return "No counterparty name supplied for sanctions screening."
        hit = self.screen(name)
        if hit:
            return (
                f"POTENTIAL MATCH: '{name}' matches sanctioned entity "
                f"'{hit.matched_name}' ({hit.program}, {hit.country}) at "
                f"{hit.similarity:.0%} similarity. Manual confirmation required."
            )
        return f"No sanctions match for '{name}' above {MATCH_THRESHOLD:.0%} similarity."


_INDEX: SanctionsIndex | None = None


def get_index() -> SanctionsIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = SanctionsIndex()
    return _INDEX

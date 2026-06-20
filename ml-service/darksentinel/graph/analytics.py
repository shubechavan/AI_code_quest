"""Transaction-graph analytics.

Accounts are nodes; transfers are directed, weighted edges. From this graph we compute
the structural signals that single-transaction scoring is blind to:

  * **Centrality** (degree, betweenness, eigenvector) — funnel/hub accounts.
  * **Mule pattern detection** — accounts that receive then rapidly forward funds.
  * **Sanctioned-path search** — shortest directed path from a party to any flagged
    entity, i.e. proximity to known-bad nodes.
  * **Risk propagation** — a damped diffusion of seed risk across the graph so an
    account transacting with high-risk neighbours inherits some of that risk.

The module is intentionally framework-light: it takes a list of edge dicts and returns
plain dicts so it can run inside the request path or be precomputed in a batch job. The
output `graph_risk` (0-1) feeds the composite score; the individual findings feed the
SHAP-grounded narrative.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import networkx as nx


@dataclass
class GraphEdge:
    """One transfer leg."""
    source: str
    target: str
    amount: float
    timestamp: int = 0  # PaySim step or unix time; used to order mule chains


@dataclass
class AccountGraphSignals:
    account: str
    degree_centrality: float = 0.0
    betweenness_centrality: float = 0.0
    eigenvector_centrality: float = 0.0
    in_degree: int = 0
    out_degree: int = 0
    is_mule_pattern: bool = False
    fan_in: int = 0
    fan_out: int = 0
    distance_to_sanctioned: int | None = None
    path_to_sanctioned: list[str] = field(default_factory=list)
    propagated_risk: float = 0.0
    graph_risk: float = 0.0  # final 0-1 structural risk for this account


def build_graph(edges: list[GraphEdge]) -> nx.DiGraph:
    """Construct a directed multigraph collapsed to a weighted DiGraph."""
    g = nx.DiGraph()
    for e in edges:
        if g.has_edge(e.source, e.target):
            g[e.source][e.target]["weight"] += e.amount
            g[e.source][e.target]["count"] += 1
            g[e.source][e.target]["timestamps"].append(e.timestamp)
        else:
            g.add_edge(
                e.source, e.target,
                weight=e.amount, count=1, timestamps=[e.timestamp],
            )
    return g


def _safe_eigenvector(g: nx.DiGraph) -> dict:
    """Eigenvector centrality can fail to converge on some graphs; degrade gracefully."""
    try:
        return nx.eigenvector_centrality_numpy(g, max_iter=500)
    except Exception:
        return {n: 0.0 for n in g.nodes}


def _detect_mule(g: nx.DiGraph, node: str, forward_ratio: float = 0.8) -> tuple[bool, int, int]:
    """A mule receives funds and forwards most of them onward shortly after.

    Heuristic: in-degree >= 1 and out-degree >= 1 and total forwarded >= forward_ratio
    of total received. Returns (is_mule, fan_in, fan_out).
    """
    in_amt = sum(d["weight"] for _, _, d in g.in_edges(node, data=True))
    out_amt = sum(d["weight"] for _, _, d in g.out_edges(node, data=True))
    fan_in = g.in_degree(node)
    fan_out = g.out_degree(node)
    is_mule = (
        fan_in >= 1 and fan_out >= 1
        and in_amt > 0 and out_amt >= forward_ratio * in_amt
    )
    return is_mule, fan_in, fan_out


def _shortest_to_sanctioned(
    g: nx.DiGraph, node: str, sanctioned: set[str]
) -> tuple[int | None, list[str]]:
    """Shortest directed path from `node` to the nearest sanctioned account."""
    best_len, best_path = None, []
    for target in sanctioned:
        if target not in g or node not in g:
            continue
        try:
            path = nx.shortest_path(g, source=node, target=target)
        except nx.NetworkXNoPath:
            continue
        if best_len is None or len(path) - 1 < best_len:
            best_len, best_path = len(path) - 1, path
    return best_len, best_path


def _propagate_risk(
    g: nx.DiGraph, seed_risk: dict[str, float], damping: float = 0.5, iters: int = 3
) -> dict[str, float]:
    """Damped risk diffusion: risk flows backward along edges (a payer to a risky payee
    inherits a fraction of that risk). Three iterations is enough for local structure
    and keeps the request path fast."""
    risk = dict(seed_risk)
    for _ in range(iters):
        nxt = dict(risk)
        for node in g.nodes:
            neighbour_risk = [
                risk.get(succ, 0.0) for succ in g.successors(node)
            ]
            if neighbour_risk:
                inherited = damping * (sum(neighbour_risk) / len(neighbour_risk))
                nxt[node] = min(1.0, max(risk.get(node, 0.0), inherited))
        risk = nxt
    return risk


def analyse_account(
    edges: list[GraphEdge],
    focus_account: str,
    sanctioned_accounts: set[str] | None = None,
    seed_risk: dict[str, float] | None = None,
) -> AccountGraphSignals:
    """Compute all structural signals for one account within its transaction graph."""
    sanctioned_accounts = sanctioned_accounts or set()
    seed_risk = seed_risk or {}
    g = build_graph(edges)

    sig = AccountGraphSignals(account=focus_account)
    if focus_account not in g:
        return sig  # isolated / unseen account: neutral structural risk

    deg = nx.degree_centrality(g)
    # Betweenness is the cost driver; sample on large graphs to stay within the request
    # budget while preserving relative ordering.
    k = min(len(g), 200)
    btw = nx.betweenness_centrality(g, k=k, normalized=True, seed=42)
    eig = _safe_eigenvector(g)

    sig.degree_centrality = round(deg.get(focus_account, 0.0), 5)
    sig.betweenness_centrality = round(btw.get(focus_account, 0.0), 5)
    sig.eigenvector_centrality = round(eig.get(focus_account, 0.0), 5)
    sig.in_degree = g.in_degree(focus_account)
    sig.out_degree = g.out_degree(focus_account)

    sig.is_mule_pattern, sig.fan_in, sig.fan_out = _detect_mule(g, focus_account)

    dist, path = _shortest_to_sanctioned(g, focus_account, sanctioned_accounts)
    sig.distance_to_sanctioned = dist
    sig.path_to_sanctioned = path

    propagated = _propagate_risk(g, seed_risk)
    sig.propagated_risk = round(propagated.get(focus_account, 0.0), 4)

    sig.graph_risk = _composite_graph_risk(sig)
    return sig


def _composite_graph_risk(sig: AccountGraphSignals) -> float:
    """Blend structural signals into a single 0-1 graph risk for the composite score.

    Weighted, capped, and explainable — each term corresponds to a finding the narrative
    can cite. We keep this transparent rather than learned so the graph contribution is
    fully auditable.
    """
    risk = 0.0
    risk += 0.30 * min(1.0, sig.betweenness_centrality * 5)      # funnel/hub behaviour
    risk += 0.15 * min(1.0, sig.eigenvector_centrality * 3)      # influence in network
    risk += 0.25 if sig.is_mule_pattern else 0.0                 # receive-and-forward
    if sig.distance_to_sanctioned is not None:
        # 1 hop -> 0.30, 2 hops -> 0.15, 3+ -> small.
        risk += min(0.30, 0.30 / sig.distance_to_sanctioned) if sig.distance_to_sanctioned else 0.30
    risk += 0.20 * sig.propagated_risk                          # risky neighbourhood
    return round(min(1.0, risk), 4)

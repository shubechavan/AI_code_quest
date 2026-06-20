"""Generate the curated demo scenarios used by the backend seed and the demo script.

These are not random rows — each is a hand-constructed, realistic case that exercises a
specific part of the system, so a reviewer can see the model behave differently across
clearly distinct situations. Writing the file here keeps the "realistic sample data"
contract in one place; the Express backend imports the JSON.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "demo_scenarios.json"

# Each scenario: a transaction plus optional graph context and a short analyst-facing
# rationale for why it is included.
SCENARIOS = [
    {
        "id": "txn_mule_to_sanctioned",
        "title": "Mule funnel forwarding to a sanctioned entity",
        "rationale": "The flagship case. The origin account is a money mule: it receives "
                     "from several sources and forwards an account-draining transfer "
                     "straight to a sanctioned counterparty. All three layers fire — the "
                     "model flags the drain, the graph finds the funnel + 1-hop sanctioned "
                     "path, and name screening matches the OFAC list.",
        "transaction": {
            "transaction_id": "txn_mule_to_sanctioned",
            "step": 14, "type": "TRANSFER", "amount": 88000.0,
            "nameOrig": "C551903", "oldbalanceOrg": 88000.0, "newbalanceOrig": 0.0,
            "nameDest": "C999001", "oldbalanceDest": 2000.0, "newbalanceDest": 2000.0,
            "counterparty_name": "Helios Marine",
        },
        "graph_edges": [
            {"source": "C840291", "target": "C551903", "amount": 52000.0, "timestamp": 11},
            {"source": "C770222", "target": "C551903", "amount": 41000.0, "timestamp": 12},
            {"source": "C551903", "target": "C999001", "amount": 88000.0, "timestamp": 14},
            {"source": "C551903", "target": "C700558", "amount": 5000.0, "timestamp": 14},
        ],
        "sanctioned_accounts": ["C999001"],
    },
    {
        "id": "txn_legit_payment",
        "title": "Routine merchant payment",
        "rationale": "Low-risk control case: a normal PAYMENT to a merchant that "
                     "reconciles cleanly. Should score LOW.",
        "transaction": {
            "transaction_id": "txn_legit_payment",
            "step": 9, "type": "PAYMENT", "amount": 1840.50,
            "nameOrig": "C223410", "oldbalanceOrg": 48230.0, "newbalanceOrig": 46389.5,
            "nameDest": "M774410", "oldbalanceDest": 0.0, "newbalanceDest": 0.0,
            "counterparty_name": "Blue Orchard Cafe",
        },
        "graph_edges": [],
        "sanctioned_accounts": [],
    },
    {
        "id": "txn_structuring",
        "title": "Large overnight transfer, unreconciled destination",
        "rationale": "High-value TRANSFER at night where the destination credit is not "
                     "reflected — a layering indicator.",
        "transaction": {
            "transaction_id": "txn_structuring",
            "step": 3, "type": "TRANSFER", "amount": 96000.0,
            "nameOrig": "C118245", "oldbalanceOrg": 99000.0, "newbalanceOrig": 3000.0,
            "nameDest": "C443120", "oldbalanceDest": 5000.0, "newbalanceDest": 5000.0,
            "counterparty_name": "Northbridge Freight",
        },
        "graph_edges": [
            {"source": "C118245", "target": "C443120", "amount": 96000.0, "timestamp": 3},
            {"source": "C443120", "target": "C118999", "amount": 95000.0, "timestamp": 4},
        ],
        "sanctioned_accounts": [],
    },
]


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(SCENARIOS, indent=2))
    print(f"Wrote {len(SCENARIOS)} scenarios -> {OUTPUT}")


if __name__ == "__main__":
    main()

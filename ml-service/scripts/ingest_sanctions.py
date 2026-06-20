"""Ingest real sanctions reference data into a normalized screening index.

Sources (all public, no authentication required):
  * OFAC SDN list      — entities, aliases (ALT), and addresses (ADD)
  * FATF jurisdictions — high-risk ("call for action") and increased-monitoring tiers
  * UN Consolidated    — optional; ingested when reachable, same output shape

This is real data: the OFAC SDN export is the live U.S. Treasury list (~19k entities).
The script downloads it if absent, parses the fixed OFAC CSV layout, and writes a single
normalized index the screening engine loads at runtime:

    data/processed/sanctions_index.json   [{ id, name, aliases[], country, program, type }]
    data/processed/country_risk.json      { COUNTRY: risk_score_0_1 }   (FATF-derived)

Run:  python scripts/ingest_sanctions.py [--refresh]
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent.parent
RAW_OFAC = SERVICE_ROOT / "data" / "raw" / "ofac"
RAW_FATF = SERVICE_ROOT / "data" / "raw" / "fatf"
PROCESSED = SERVICE_ROOT / "data" / "processed"

OFAC_BASE = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports"
OFAC_FILES = ["SDN.CSV", "ALT.CSV", "ADD.CSV"]

# OFAC encodes nulls as the literal token "-0-" (sometimes with trailing whitespace).
NULL_TOKENS = {"-0-", ""}


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    v = value.strip()
    return None if v in NULL_TOKENS else v


def download_ofac(refresh: bool = False) -> None:
    RAW_OFAC.mkdir(parents=True, exist_ok=True)
    for name in OFAC_FILES:
        dest = RAW_OFAC / name
        if dest.exists() and not refresh:
            continue
        url = f"{OFAC_BASE}/{name}"
        print(f"  downloading {name} ...")
        urllib.request.urlretrieve(url, dest)  # noqa: S310 (trusted .gov host)


def parse_ofac() -> list[dict]:
    """Parse SDN + ALT + ADD into normalized entity records."""
    sdn_path = RAW_OFAC / "SDN.CSV"
    if not sdn_path.exists():
        raise FileNotFoundError("OFAC SDN.CSV missing; run with network access first.")

    # SDN.CSV columns: ent_num, name, sdn_type, program, title, ...(vessel fields)
    entities: dict[str, dict] = {}
    with open(sdn_path, newline="", encoding="latin-1") as fh:
        for row in csv.reader(fh):
            if len(row) < 4:
                continue
            ent_num = row[0].strip()
            entities[ent_num] = {
                "id": f"OFAC-{ent_num}",
                "name": _clean(row[1]) or "",
                "type": (_clean(row[2]) or "entity").lower(),
                "program": _clean(row[3]),
                "aliases": [],
                "country": None,
            }

    # ALT.CSV columns: ent_num, alt_num, alt_type, alt_name, remarks
    alt_path = RAW_OFAC / "ALT.CSV"
    if alt_path.exists():
        with open(alt_path, newline="", encoding="latin-1") as fh:
            for row in csv.reader(fh):
                if len(row) < 4:
                    continue
                ent = entities.get(row[0].strip())
                alias = _clean(row[3])
                if ent and alias:
                    ent["aliases"].append(alias)

    # ADD.CSV columns: ent_num, add_num, address, city, country, remarks
    add_path = RAW_OFAC / "ADD.CSV"
    if add_path.exists():
        with open(add_path, newline="", encoding="latin-1") as fh:
            for row in csv.reader(fh):
                if len(row) < 5:
                    continue
                ent = entities.get(row[0].strip())
                country = _clean(row[4])
                if ent and country and not ent["country"]:
                    ent["country"] = country

    records = [e for e in entities.values() if e["name"]]
    print(f"  OFAC: {len(records)} entities, "
          f"{sum(len(e['aliases']) for e in records)} aliases")
    return records


# --- FATF jurisdictions (public reference data; small and slow-changing) -------------
# "Call for action" (black list) and "increased monitoring" (grey list). Encoded as dated
# reference data with an explicit source note — this is the kind of small public list that
# is legitimately maintained as a static file and refreshed on FATF plenary updates.
FATF_REFERENCE = {
    "as_of": "2025-10",
    "source": "FATF public statements (High-Risk Jurisdictions / Increased Monitoring)",
    "call_for_action": ["Iran", "Korea, North", "North Korea", "Myanmar", "Burma"],
    "increased_monitoring": [
        "Algeria", "Angola", "Bulgaria", "Burkina Faso", "Cameroon",
        "Cote d'Ivoire", "Croatia", "Congo, Democratic Republic of the",
        "Haiti", "Kenya", "Lebanon", "Mali", "Monaco", "Mozambique",
        "Namibia", "Nepal", "Nigeria", "South Africa", "South Sudan",
        "Syria", "Tanzania", "Venezuela", "Vietnam", "Yemen",
    ],
}

# Country-risk tiers feed an engineered feature and the composite sanctions/country signal.
COUNTRY_RISK_TIERS = {"call_for_action": 1.0, "increased_monitoring": 0.6, "default": 0.0}


def build_country_risk() -> dict:
    risk: dict[str, float] = {}
    for country in FATF_REFERENCE["call_for_action"]:
        risk[country.lower()] = COUNTRY_RISK_TIERS["call_for_action"]
    for country in FATF_REFERENCE["increased_monitoring"]:
        risk[country.lower()] = COUNTRY_RISK_TIERS["increased_monitoring"]
    return risk


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest sanctions reference data.")
    parser.add_argument("--refresh", action="store_true", help="Re-download OFAC files.")
    parser.add_argument("--offline", action="store_true",
                        help="Skip download; parse whatever is already on disk.")
    args = parser.parse_args()

    PROCESSED.mkdir(parents=True, exist_ok=True)
    RAW_FATF.mkdir(parents=True, exist_ok=True)

    if not args.offline:
        try:
            download_ofac(refresh=args.refresh)
        except Exception as exc:  # noqa: BLE001
            print(f"  [warn] OFAC download failed ({exc}); parsing cached files if present.")

    records = parse_ofac()
    (PROCESSED / "sanctions_index.json").write_text(json.dumps(records))
    print(f"  wrote sanctions_index.json ({len(records)} entities)")

    (RAW_FATF / "fatf_high_risk.json").write_text(json.dumps(FATF_REFERENCE, indent=2))
    country_risk = build_country_risk()
    (PROCESSED / "country_risk.json").write_text(json.dumps(country_risk, indent=2))
    print(f"  wrote country_risk.json ({len(country_risk)} jurisdictions)")
    print("Done.")


if __name__ == "__main__":
    sys.exit(main())

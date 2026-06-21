# Data card

## What this project trains on

The **real [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) dataset** —
6,362,620 transactions, 0.129% fraud — placed at
`ml-service/data/raw/paysim/*.csv` and loaded by
[`darksentinel/data/loader.py`](../ml-service/darksentinel/data/loader.py). The CSV is
gitignored (493MB) and not committed; drop it in and `python scripts/train_model.py`
trains on it automatically. Confirmed properties on load: fraud occurs only in `CASH_OUT`
and `TRANSFER`, exactly as the literature describes.

If the CSV is absent, training transparently falls back to a **synthetic, PaySim-schema**
generator ([`data/synthetic.py`](../ml-service/darksentinel/data/synthetic.py)) so the
project still runs end-to-end offline. The synthetic generator reproduces PaySim's schema
and fraud mechanics so the feature pipeline is byte-for-byte identical between the two:

- Identical columns (`step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig,
  nameDest, oldbalanceDest, newbalanceDest, isFraud, isFlaggedFraud`), so the feature
  pipeline is byte-for-byte the same for a real PaySim CSV.
- Fraud only through `TRANSFER`/`CASH_OUT`; account-draining to zero; balance-reconciliation
  failures on fraudulent legs; mule receive-and-forward patterns.

### Realism: deliberate, measured overlap

A naive generator makes fraud trivially separable and produces a fake-looking PR-AUC of
1.0. To keep metrics honest we inject overlap (see the module's comments):

- ~2% of legitimate large transfers genuinely drain an account (account closure, payroll
  sweep) — benign look-alikes.
- ~5% settlement lag where a legitimate destination credit isn't yet reflected.
- ~20% "structuring" fraud that withdraws partial amounts to evade thresholds.
- ~0.25% label noise (delayed chargebacks, investigation reversals).

This lands the calibrated model around **PR-AUC 0.72, precision 0.96, recall 0.67, Brier
0.005** on a held-out time-split fold — believable, not perfect.

## To use real datasets

Drop a real PaySim CSV in place of the generator and point `train.py` at it — the schema
matches, so nothing downstream changes. The original brief's other datasets map as:

| Dataset | Intended role |
| --- | --- |
| PaySim | Primary supervised training + transaction graph |
| IEEE-CIS Fraud | Isolation Forest anomaly model + feature ideas |
| ULB Credit Card | Anomaly model (PCA features unsuitable for SHAP — not for the classifier) |
| OFAC SDN / UN Consolidated | Merged sanctions index (Jaro-Winkler screening) |
| FATF high-risk jurisdictions | Country-risk feature |

## Sanctions data is real

Unlike the transaction data, the sanctions screening uses the **live OFAC SDN list**,
which is publicly downloadable with no authentication.
[`scripts/ingest_sanctions.py`](../ml-service/scripts/ingest_sanctions.py) downloads and
parses the real SDN + ALT (aliases) + ADD (addresses) exports — **19,073 entities, 20,292
aliases** — into a normalized index, and screening matches counterparty names against it
with RapidFuzz. FATF high-risk jurisdictions feed a country-risk signal. The UN Consolidated
list plugs into the same ingestion shape (planned).

```bash
cd ml-service
python scripts/ingest_sanctions.py        # downloads live OFAC, writes data/processed/
```

If the index has not been ingested, screening falls back to a small clearly-fictional
sample so the service still runs offline — but the production path is the real list.

# Data card

## What this project trains on

The **real [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) dataset** —
6,362,620 transactions, 0.129% fraud — placed at `ml-service/data/raw/paysim/*.csv` and
loaded by [`darksentinel/data/loader.py`](../ml-service/darksentinel/data/loader.py). The
CSV is gitignored (~493MB) and not committed; download it from Kaggle, drop it in, and
`python scripts/train_model.py` trains on it. Confirmed properties on load: fraud occurs
only in `CASH_OUT` and `TRANSFER`, exactly as the literature describes.

Training **requires** the CSV — if it is absent the loader raises a clear error pointing to
the Kaggle source. There is no synthetic stand-in: every reported metric comes from the real
dataset.

### Pipeline & anti-leakage guards

- **25-feature pipeline** shared byte-for-byte between training and serving (no train/serve
  skew), built in [`features/engineering.py`](../ml-service/darksentinel/features/engineering.py).
- **Chronological split** on PaySim's `step` (time) field — no future-into-past leakage.
- **RandomUnderSampler + SMOTE on the training fold only**; calibration and test folds keep
  the true 0.129% prior so calibrated probabilities and metrics stay honest.
- **`isFlaggedFraud` dropped at load** — it is the obvious leaked label.
- SHAP importance is verified to spread across legitimate balance/amount features rather than
  concentrating on any single leak.

## Sanctions data is real

The sanctions screening uses the **live OFAC SDN list**, publicly downloadable with no
authentication. [`scripts/ingest_sanctions.py`](../ml-service/scripts/ingest_sanctions.py)
downloads and parses the real SDN + ALT (aliases) + ADD (addresses) exports — **19,073
entities, 20,292 aliases** — into a normalized index, and screening matches counterparty
names against it with **RapidFuzz** `token_set_ratio` (case-insensitive) above an 88%
threshold. FATF high-risk jurisdictions feed a country-risk signal.

```bash
cd ml-service
python scripts/ingest_sanctions.py        # downloads live OFAC, writes data/processed/
```

If the index has not been ingested, screening falls back to a small clearly-fictional sample
so the service still runs offline — but the production path is the real list.

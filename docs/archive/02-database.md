# Data model

The slice uses an in-memory store (`backend/src/data/store.js`) implementing the same
access patterns as the target MongoDB design, behind a `Collection` interface whose
methods (`insert`, `get`, `update`, `find`, `count`) map 1:1 to Mongo operations. This
section documents the production MongoDB schema; swapping the driver in is a localized
change confined to `store.js`.

## Collections

### `users`
Console accounts. Passwords are bcrypt-hashed; never stored in plaintext.
```json
{
  "_id": "usr_8a1f...",
  "email": "analyst@darksentinel.io",
  "name": "Priya Nair",
  "role": "analyst",                       // analyst | risk_manager | admin
  "tenantId": "tenant_demo",
  "passwordHash": "$2a$10$...",
  "createdAt": "2026-06-20T09:00:00Z"
}
```
Indexes: unique `email`; `tenantId`.

### `transactions`
Raw PaySim-schema records as submitted.
```json
{
  "_id": "txn_3c9d...",
  "type": "TRANSFER",
  "amount": 88000,
  "nameOrig": "C551903", "oldbalanceOrg": 88000, "newbalanceOrig": 0,
  "nameDest": "C999001", "oldbalanceDest": 2000, "newbalanceDest": 2000,
  "counterparty_name": "Helios Marine",
  "tenantId": "tenant_demo",
  "submittedBy": "usr_8a1f...",
  "createdAt": "2026-06-20T10:14:00Z"
}
```
Indexes: `tenantId`, `nameOrig`, `createdAt`.

### `assessments`
The scored result + full evidence for one transaction. The UI reads this directly.
```json
{
  "_id": "asm_77b2...",
  "transactionId": "txn_3c9d...",
  "tenantId": "tenant_demo",
  "modelVersion": "ds-xgb-2026.06",
  "compositeScore": 99.1,
  "riskBand": "critical",
  "supervisedProbability": 1.0,
  "anomalyScore": 0.937,
  "graphRisk": 0.9,
  "explanation": { "base_value": -6.1, "raw_margin": 7.4, "attributions": [ ... ] },
  "graphSignals": { "is_mule_pattern": true, "distance_to_sanctioned": 1, ... },
  "graphEdges": [ { "source": "...", "target": "...", "amount": 88000 } ],
  "contributingFactors": [ { "source": "model", "label": "...", "contribution": 1.2 } ],
  "brief": { "risk_summary": "...", "recommended_action": "..." }
}
```
Indexes: `transactionId`, `tenantId`, `compositeScore` (for risk-sorted queues).

### `alerts`
Opened when a band warrants review. Carries the alert state machine and SAR status.
```json
{
  "_id": "alt_19c0...",
  "transactionId": "txn_3c9d...",
  "assessmentId": "asm_77b2...",
  "tenantId": "tenant_demo",
  "riskBand": "critical",
  "compositeScore": 99.1,
  "state": "open",                  // open → in_review → resolved | escalated
  "assignedTo": null,
  "sarStatus": "not_filed"          // not_filed | drafting | filed
}
```
Indexes: `tenantId`, `state`, `assignedTo`.

### `auditLogs`
Immutable, append-only activity trail. Long retention; never updated or deleted.
```json
{
  "_id": "aud_4f88...",
  "action": "transaction.analyze",  // transaction.analyze | report.generate | user.create
  "resourceType": "transaction",
  "resourceId": "txn_3c9d...",
  "actorId": "usr_8a1f...",
  "actorRole": "analyst",
  "tenantId": "tenant_demo",
  "ip": "127.0.0.1",
  "metadata": { "riskBand": "critical", "alertOpened": true },
  "timestamp": "2026-06-20T10:14:01Z"
}
```
Indexes: `tenantId`, `timestamp` (descending), `actorId`. TTL optional per retention policy.

### `reports`
Point-in-time snapshot of an assessment's brief and evidence. Re-scoring does not mutate
a filed report.
```json
{
  "_id": "rpt_5a2e...",
  "assessmentId": "asm_77b2...",
  "transactionId": "txn_3c9d...",
  "tenantId": "tenant_demo",
  "generatedBy": "usr_8a1f...",
  "generatedByName": "Priya Nair",
  "modelVersion": "ds-xgb-2026.06",
  "snapshot": { "compositeScore": 99.1, "riskBand": "critical", "brief": { ... } },
  "createdAt": "2026-06-20T10:20:00Z"
}
```
Indexes: `tenantId`, `assessmentId`, `createdAt`.

### `sanctions_cache` and `model_metrics` (ML-service-owned in the slice)
- `sanctions_cache` — merged OFAC + UN index with aliases, plus a timed cache of recent
  fuzzy-match results. In the slice this is the in-memory `SanctionsIndex`.
- `model_metrics` — model performance over time. In the slice this is
  `artifacts/model_metadata.json`, surfaced via `GET /model`.

## Tenant isolation

Every tenant-scoped collection carries `tenantId`, and every query filters on the
authenticated user's `tenantId` (read from the JWT, never from the client). This is the
single mechanism that keeps one institution's data invisible to another.

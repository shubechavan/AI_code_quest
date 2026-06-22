# API reference

Base URL (dev): `http://localhost:4000/api` (the frontend proxies `/api` to this).
All routes except `/auth/login` and `/auth/refresh` require `Authorization: Bearer <token>`.
Authorization is enforced per route by RBAC permission.

## Auth

### `POST /auth/login`
```json
// request
{ "email": "analyst@darksentinel.io", "password": "Analyst#2026" }
// 200
{
  "user": { "id": "usr_...", "email": "...", "name": "Priya Nair", "role": "analyst", "tenantId": "tenant_demo" },
  "accessToken": "<jwt RS256, 15m>",
  "refreshToken": "<jwt RS256, 7d, revocable>"
}
// 401 { "error": "Invalid email or password" }
```

### `POST /auth/refresh`
```json
{ "refreshToken": "<token>" }  →  { "accessToken": "...", "refreshToken": "..." }
```
Refresh tokens are single-use: the presented token is revoked and a new pair issued
(rotation). Reusing a rotated token returns 401.

### `GET /auth/me` → `{ "user": { ... } }`
### `POST /auth/logout` → `{ "ok": true }` (revokes all refresh tokens for the user)
### `POST /auth/register` *(permission: `user:manage`)*
Admin-only provisioning. `{ email, name, password (≥8), role }` → `201 { user }`.

## Transactions

### `POST /transactions/analyze` *(permission: `transaction:analyze`)*
```json
// request
{
  "transaction": {
    "type": "TRANSFER", "amount": 88000,
    "nameOrig": "C551903", "oldbalanceOrg": 88000, "newbalanceOrig": 0,
    "nameDest": "C999001", "oldbalanceDest": 2000, "newbalanceDest": 2000,
    "counterparty_name": "Helios Marine"
  },
  "graphEdges": [ { "source": "C840291", "target": "C551903", "amount": 52000, "timestamp": 11 } ],
  "sanctionedAccounts": ["C999001"]
}
// 201
{ "transaction": { ... }, "assessment": { "compositeScore": 99.1, "riskBand": "critical", "explanation": {...}, "brief": {...} }, "alert": { "state": "open" } }
// 422 { "error": "Validation failed", "issues": [ { "path": "amount", "message": "..." } ] }
// 503 { "error": "ML service unreachable ..." }
```

### `GET /transactions` *(permission: `transaction:read`)*
Query: `band` (critical|high|medium|low), `search` (id/account), `limit`.
Returns `{ count, results: [ { transaction, assessment } ] }`, risk-sorted.

### `GET /transactions/:id` *(permission: `transaction:read`)*
Returns `{ transaction, assessment, alert }`. 404 if not in caller's tenant.

### `GET /transactions/:id/graph` *(permission: `transaction:read`)*
Returns `{ edges, signals, focusAccount }` for the network visualization.

## Reports

### `POST /reports/:assessmentId/generate` *(permission: `report:generate`)*
Snapshots the assessment's brief + evidence into a persisted, immutable report. → `201 { report }`.

### `GET /reports/:id` *(permission: `report:generate`)* → `{ report }`
### `GET /reports` *(permission: `report:generate`)* → `{ count, results }`

PDF export is performed client-side from the print-ready report view (`/reports/:id/view`)
via the browser's Print → Save as PDF — infra-free and produces vector text.

## Dashboard

### `GET /dashboard/summary` *(permission: `transaction:read`)*
```json
{
  "totals": { "analyzed": 3, "openAlerts": 2, "reports": 0 },
  "byBand": { "critical": 2, "high": 0, "medium": 0, "low": 1 },
  "model": { "version": "ds-xgb-2026.06", "metrics": { "pr_auc": 0.72, ... }, "baseline": {...}, "topFeatures": [...] }
}
```

## Admin

### `GET /admin/audit-logs` *(permission: `audit:read`)* → `{ count, results }` newest-first
### `GET /admin/users` *(permission: `user:manage`)* → `{ count, results }`

## Health

### `GET /health` (gateway, unauthenticated) → `{ "status": "ok", "mlService": "ok" }`

## ML service (internal, not exposed to the browser)

- `GET /health` — `{ status, artifacts_loaded, service_version }`
- `GET /model` — full model metadata (version, metrics, global SHAP importance)
- `POST /score` — see `ml-service/darksentinel/schemas.py` for the Pydantic contract;
  interactive docs at `http://localhost:8000/docs`.

## RBAC matrix

| Permission | Analyst | Risk Manager | Admin |
| --- | :-: | :-: | :-: |
| `transaction:read` | ✓ | ✓ | ✓ |
| `transaction:analyze` | ✓ | ✓ | ✓ |
| `report:generate` | ✓ | ✓ | ✓ |
| `alert:resolve` | | ✓ | ✓ |
| `audit:read` | | ✓ | ✓ |
| `user:manage` | | | ✓ |

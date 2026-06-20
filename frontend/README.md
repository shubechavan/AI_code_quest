# DarkSentinel analyst console

React + Vite + Tailwind front end for the financial-crime risk platform.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api → http://localhost:4000)
npm run build      # production bundle to ./dist
```

The gateway (`:4000`) and ML service (`:8000`) must be running for live data.

## Design system

A deliberately restrained system tuned for an all-day analyst tool — see
`tailwind.config.js`:

- **One neutral scale** for surfaces and text; **one accent** (`accent`) for primary
  actions and active navigation only.
- **Four risk colours** (critical/high/medium/low) used solely as small status indicators
  via `RiskBadge` and `lib/risk.js` — never as decorative gradients or backgrounds.
- **One elevation** (`shadow-card`). No glassmorphism, no glows, no incidental animation.
- **Inter** for UI, **JetBrains Mono** for identifiers and figures; tabular numerals on all
  numeric columns.
- Consistent `States.jsx` primitives (`LoadingState`, `EmptyState`, `ErrorState`) so every
  data view handles the non-happy paths.

## Structure

```
src/
  lib/            api client (auto token-refresh), formatters, risk styling, useAsync
  context/        AuthContext — session restore + permission gating
  components/
    ui/           Button, Card, RiskBadge, States
    layout/       Sidebar (permission-filtered nav), Topbar, AppLayout
    charts/       ShapWaterfall (Recharts), ScoreGauge (SVG), NetworkGraph (React Flow)
  pages/          Login, Dashboard, AlertQueue, TransactionDetail, Analyze,
                  Reports, ReportView (print-ready), Audit, Admin, NotFound
```

## Notable decisions

- **URL-driven filters** on the alert queue (band, search) so views are shareable and
  survive refresh.
- **Print-to-PDF** report export from a standalone print view — no server PDF dependency,
  vector-accurate output.
- **Permission-gated navigation** mirrors the server's RBAC so each persona sees only the
  routes their role grants (the server remains the source of truth).

# pekulo

Personal finance dashboard — capital tracking, multi-currency portfolio, holdings history.

> _Pekulo_ — from Latin _peculium_, the personal stash one sets aside.

Month-by-month tracking of savings, expenses, transactions, and a portfolio (Livret A, PEA, CTO, AV) with ETFs and individual stocks. Prices are auto-refreshed, currencies normalized to EUR, and a buy/sell history feeds a weighted-average cost basis on each holding.

---

## Stack

- **Monorepo** — Bun + Turborepo, two apps (`apps/web`, `apps/prices`)
- **Web** — Next.js 16 (Turbopack) + React 19 + Tailwind 4 + shadcn × base-ui
- **Data** — Supabase (Postgres + Auth + RLS on every table)
- **Forms / mutations** — TanStack Form + zod + ZapAction (`defineAction` with tags + revalidate)
- **Charts** — Recharts via shadcn `ChartContainer` (allocation donut, capital, scenarios, annual)
- **Prices** — 4-tier fallback chain: `apps/prices` (Python yfinance on a VPS) → `yahoo-finance2` (npm) → Boursorama scraping → Twelve Data
- **FX** — frankfurter.app (ECB rates, free, EUR base)
- **Prices service** — FastAPI + yfinance + curl_cffi, deployable via Dokploy/Docker

## Layout

```
.
├── apps/
│   ├── web/                 # Next.js 16 — dashboard + auth + tables
│   └── prices/              # FastAPI + yfinance — real-time price service
├── docs/
│   ├── quick-specs/         # 10 APED specs that produced the current version
│   └── state.yaml
├── package.json             # workspaces ["apps/web"], dotenv-prefixed scripts
├── turbo.json               # dev / build / lint / check-types pipelines
├── .env.example             # all vars (Supabase, prices service, Twelve Data)
└── bun.lock
```

## Quick start (local)

Requirements: Bun ≥ 1.3, Python ≥ 3.10 (optional, for the prices service), a Supabase project.

```bash
# 1. Clone + install
git clone git@github.com:yabafre/pekulo.git
cd pekulo
bun install

# 2. Configure env (copy then fill)
cp .env.example .env.local
# Required at minimum:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Provision the database
# Open Supabase Studio → SQL Editor → run apps/web/supabase-schema.sql

# 4. Start the dev server (from the repo root)
bun run dev
# → Next.js on http://localhost:3000
```

First sign-in: log into Supabase, then visit `/dashboard/parametres` to enter your assumptions (salary, expenses, ETF perf), then `/dashboard/portefeuille` to add accounts and holdings.

### Python prices service (optional, local)

```bash
cd apps/prices
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Sanity-check
curl http://localhost:8000/health
curl "http://localhost:8000/quote?symbol=PE500.PA"
```

If your home IP is rate-limited by Yahoo (frequent in EU), the Next.js app falls back to Boursorama automatically. Once deployed on a VPS via Dokploy, the different egress IP avoids the rate limit.

## Pages

| Route                         | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `/dashboard`                  | KPI strip + charts + actual vs projected capital        |
| `/dashboard/parametres`       | Editable assumptions (salary, expenses, ETF perf, etc.) |
| `/dashboard/mensuel`          | 60 projected/actual months with cumulative deviation    |
| `/dashboard/transactions`     | Inflows/outflows + one-off events, filterable           |
| `/dashboard/portefeuille`     | Accounts + holdings + AllocationChart + price refresh   |
| Each holding's history button | Buy/sell lots with a derived weighted-average cost      |

## Environment variables

| Variable                        | Required | Description                                                                     |
| ------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | Supabase project URL                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | Supabase anon key                                                               |
| `PRICES_SERVICE_URL`            | optional | URL of the Python service (otherwise falls back to yahoo-finance2 + Boursorama) |
| `PRICES_SERVICE_TOKEN`          | optional | Bearer token, if the service is protected                                       |
| `TWELVE_DATA_API_KEY`           | optional | Free tier 800 req/day, US-only fallback                                         |

See `.env.example` for the full list with comments.

## Price fallback architecture

```
fetchPriceQuote({ ticker, currency, kind })
       │
       ├─① Python service (apps/prices, deployed on VPS via Dokploy)
       │     PRICES_SERVICE_URL → yfinance + curl_cffi
       │
       ├─② yahoo-finance2 (npm) — handles EU consent + crumb automatically
       │
       ├─③ Boursorama scraping — covers Euronext FR (PE500, CW8, etc.)
       │     /recherche/?query=<TICKER> → redirects to canonical quote page
       │
       └─④ Twelve Data — US-only fallback (free tier doesn't cover EU)

→ First provider that responds wins. 60s cache per symbol.
→ If all fail: composite PriceError with the per-provider reason.
```

## Holdings & lots

- `accounts` — Livret A, PEA, CTO, AV — currency + cash balance
- `holdings` — ETFs/stocks attached to an account — qty + avg_cost + last_price
- `holding_lots` — buy/sell history — qty / price / fees / date

When a holding has lots, `qty` and `avg_cost` become **derived** (weighted average) on every mutation. A holding without lots stays in manual entry mode for back-compat.

## Specs

The project was built through 10 APED quick-specs, all in `docs/quick-specs/`. Read them in order to follow the evolution:

1. `hypotheses-editor` — editable settings, foundation
2. `monthly-actuals` — month-by-month entry
3. `transactions-imprevus` — transactions CRUD
4. `placements-foundation` — accounts + holdings (qs-04a)
5. `placements-yahoo` — auto price refresh v1 (qs-04b)
6. `placements-yahoo-fallbacks` — Yahoo crumb + Twelve Data (qs-04b-bis)
7. `placements-prices-rewrite` — yahoo-finance2 + Python sidecar (qs-04b-final)
8. `placements-fx` — multi-currency via frankfurter (qs-04c)
9. `placements-lots` — buy/sell history + derivation (qs-04d)
10. `monorepo-migration` — Bun + Turborepo + root .env

## Deployment

- **`apps/web`** → Vercel recommended (native Next.js). Push from `main`. Configure Supabase env vars + (optional) `PRICES_SERVICE_URL` + `TWELVE_DATA_API_KEY`.
- **`apps/prices`** → Dokploy or any Docker runtime. Build context: `apps/prices/`. See `apps/prices/README.md` for details.

## License

Private. All rights reserved.

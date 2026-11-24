# Pekulo

Goal-based personal finance application — compass & milestones, accounts, multi-currency portfolio with lot-based cost basis, real-estate equity, transactions with hybrid AI auto-categorisation, and monthly sign-off across Web (PWA) and Mobile (iOS).

> _Pekulo_ — from Latin _peculium_, the personal stash one sets aside.

---

## Stack

- **Monorepo** — Bun (`bun@1.3.14`) + Turborepo, 4 apps and 8 `@pekulo/*` packages
- **Web (`apps/web`)** — Next.js 16 (App Router, Turbopack) + React 19 + `@pekulo/ui` (Tamagui Core v2) + TanStack Form + React Query via ZapAction + encrypted IndexedDB offline PWA cache
- **Domain API (`apps/api`)** — Bun + ElysiaJS + contract-first oRPC (`/rpc/v1/*`) + Prisma 7 (`prismaSchemaFolder`, prefixed IDs) + OpenTelemetry + GlitchTip
- **Mobile (`apps/mobile`)** — Expo SDK 58 + `expo-router` + `@pekulo/ui` native surface + Supabase Auth (`expo-secure-store`) + `@pekulo/contracts` oRPC + Maestro E2E on EAS Workflows
- **Data & Auth** — Supabase (Postgres + Auth + RLS on every table, defense-in-depth `userId` lint guard)
- **Prices (`apps/prices`)** — 4-tier fallback chain: `apps/prices` (FastAPI + `yfinance` + `curl_cffi`) → `yahoo-finance2` → Boursorama → Twelve Data (60 s cache), plus ECB FX via `frankfurter.app`
- **AI categorisation** — hybrid routing (Apple FoundationModels / self-hosted Ollama / opt-in EU third-party LLM) with append-only audit log (`llm_call_log`)
- **Tooling** — `oxlint` (with custom `@pekulo/oxlint-config` rules), `oxfmt`, `lefthook` (`gitleaks`, lint, format, Prisma format, Tamagui CSS freshness)

## Monorepo layout

```text
.
├── apps/
│   ├── web/                 # Next.js 16 PWA — dashboard, auth, offline cache (Vercel)
│   ├── api/                 # Bun + ElysiaJS + oRPC + Prisma 7 domain API (Dokploy)
│   ├── mobile/              # Expo SDK 58 iOS app + Maestro E2E + EAS Workflows
│   └── prices/              # FastAPI + yfinance — real-time quote sidecar (Dokploy)
├── packages/
│   ├── ui/                  # @pekulo/ui — Tamagui v2 Design System (web + native + parity gate)
│   ├── contracts/           # @pekulo/contracts — oRPC v1 contracts
│   ├── validators/          # @pekulo/validators — Zod v4 schemas
│   ├── types/               # @pekulo/types — shared domain & UI types
│   ├── zod/                 # @pekulo/zod — single Zod entrypoint
│   ├── observability/       # @pekulo/observability — OTel + GlitchTip PII scrubbing
│   ├── oxlint-config/       # @pekulo/oxlint-config — custom architecture lint rules
│   └── tsconfig/            # @pekulo/tsconfig — shared TypeScript 6 presets
├── docs/
│   ├── architecture.md      # Architecture, ADRs, conventions (R1–R11)
│   ├── adr/                 # Architecture Decision Records
│   ├── epics.md             # Epics & stories backlog
│   └── state.yaml           # APED pipeline & sprint state
├── .env.example             # Root environment template (loaded via dotenv-cli)
├── package.json             # Root scripts & workspaces
├── turbo.json               # Turborepo task graph
└── bun.lock
```

## Quick start (local)

Requirements: **Bun `1.3.14`**, Docker (optional, for local Supabase Postgres), Python ≥ 3.10 (optional, for `apps/prices`), Xcode + iOS Simulator + Maestro CLI (optional, for `apps/mobile`).

```bash
# 1. Clone + install
git clone git@github.com:yabafre/pekulo.git
cd pekulo
bun install

# 2. Configure root env (copy then fill)
cp .env.example .env.local
# Required at minimum for local web + api:
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY
#   DATABASE_URL, API_BASE_URL

# 3. Apply Prisma migrations
bun run prisma:migrate:dev

# 4. Start dev servers (from the repo root)
bun run dev
# Or target a single surface:
bun run dev:web          # Next.js web app
bun run mobile:ios       # Expo Dev Client on iOS Simulator
bun run dev:mobile       # Metro bundler for Dev Client
bun run dev:prices       # FastAPI quote sidecar on :8000
```

See [apps/mobile/README.md](apps/mobile/README.md) for mobile development, the web ↔ native token-parity gate, and Maestro / EAS Workflows commands.

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

## Quality gates & tests

Run from the repository root:

```bash
# Static checks
bun run typecheck
bun run lint
bun run format:check
bun run prisma:check
bun run db:rls-audit
bun run generate:tamagui-css && git diff --exit-code packages/ui/public/tamagui.generated.css

# Test suites
bun run test:ui                      # @pekulo/ui (Vitest: snapshots, vitest-axe, parity baseline)
bun run test:mobile                  # @pekulo/mobile (Jest: auth/oRPC, screens, native token parity)
bun --filter='@pekulo/web' run test  # @pekulo/web (Vitest)
bun --filter='@pekulo/api' run test  # @pekulo/api (bun test)
```

## Main routes

| Route (web)               | Mobile tab / surface | Purpose                                                                 |
| ------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `/dashboard`              | `Cap`                | Configurable net-worth overview, compass progress, milestones, activity |
| `/dashboard/transactions` | `Transactions`       | Inflows/outflows, CSV/Bridge import, AI category suggestions            |
| `/dashboard/mensuel`      | `Mensuel`            | Monthly actuals, cumulative deviation, close-window sign-off            |
| `/dashboard/portefeuille` | `Portefeuille`       | Accounts, holdings, buy/sell lots, FX & live quotes                     |
| `/dashboard/immobilier`   | `Immobilier`         | Properties, valuation history, mortgages, rental cashflow               |
| `/dashboard/parametres`   | `Paramètres` (sheet) | Theme, language, compass & hypotheses, AI opt-in & log, GDPR export     |

## Environment variables

Root `.env` / `.env.local` (gitignored) is loaded across workspaces via `dotenv-cli`. Main groups:

| Group         | Key variables                                                                                      | Consumer               |
| ------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| Supabase      | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET` | `apps/web`, `api`      |
| Database      | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                          | `apps/api` (Dokploy)   |
| Internal API  | `API_BASE_URL`, `HOST`, `PORT`                                                                     | `apps/web`, `api`      |
| Mobile (Expo) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`            | `apps/mobile`          |
| Prices & FX   | `PRICES_SERVICE_URL`, `PRICES_SERVICE_TOKEN`, `TWELVE_DATA_API_KEY`, `FRANKFURTER_BASE_URL`        | `apps/api`, `prices`   |
| AI & Logos    | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `THIRD_PARTY_LLM_API_KEY`, `BRANDFETCH_API_KEY`                 | `apps/api`             |
| Bank sync     | `BRIDGE_CLIENT_ID`, `BRIDGE_CLIENT_SECRET`, `BRIDGE_WEBHOOK_SIGNING_SECRET`                        | `apps/api`             |
| Observability | `OTEL_EXPORTER_OTLP_ENDPOINT`, `GLITCHTIP_DSN`, `NEXT_PUBLIC_GLITCHTIP_DSN`                        | `web`, `api`, `prices` |

See `.env.example` for the complete documented list.

## Price fallback architecture

```text
fetchPriceQuote({ ticker, currency, kind })
       │
       ├─① Python service (apps/prices, Dokploy VPS) — yfinance + curl_cffi
       ├─② yahoo-finance2 (npm) — EU consent + crumb handling
       ├─③ Boursorama scraping — Euronext FR coverage
       └─④ Twelve Data — US-only fallback (free tier)

→ First provider that responds wins (60 s in-memory cache per ticker|kind|currency).
→ If all fail: composite PriceProviderError with per-provider attempts.
```

## Deployment

- **`apps/web`** — Vercel (Next.js App Router, auto-deploy from `main`).
- **`apps/api` + `apps/prices` + Ollama** — Dokploy VPS behind Caddy reverse proxy (`prisma migrate deploy` on deploy).
- **`apps/mobile`** — EAS Build & EAS Workflows (`apps/mobile/eas.json`, `apps/mobile/.eas/workflows/`).

## License

Private. All rights reserved.

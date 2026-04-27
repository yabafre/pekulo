# Quick Spec: Placements — Replace hand-rolled fetchers with real libs (qs-04b-final)

**Date:** 2026-04-27
**Author:** Alex
**Type:** refactor + feature
**Status:** done-awaiting-vps-deploy

## What

Two coordinated changes:

1. **Next.js side** — replace my hand-rolled `yahoo-finance.ts` (300 lines, fragile) with the `yahoo-finance2` npm package (~50 lines, mature, handles consent/crumb internally).
2. **Python sidecar** — new `prices-service/` folder at repo root, FastAPI + yfinance, deployed on Alex's VPS via Dokploy. Used as the **primary** price provider in the Next.js orchestrator (different IP than Vercel → not subject to the same Yahoo rate-limits).

After this spec the chain becomes: **Python service (VPS) → yahoo-finance2 (npm) → Boursorama → Twelve Data**. Each layer falls back gracefully.

## Why

We've burned cycles on Yahoo's hostile undocumented endpoints (429, missing cookies, EU consent). The community has already solved this — `yfinance` (Python) and `yahoo-finance2` (Node) are 7-50k★ libs that handle every Yahoo quirk. Using them is just the right call. The Python sidecar adds a network-level redundancy: even if Vercel's egress IP is rate-limited, Alex's VPS likely isn't.

## Acceptance Criteria

### Next.js side

- [ ] Install `yahoo-finance2` npm.
- [ ] Rewrite `src/lib/services/yahoo-finance.ts` to be a thin wrapper around `yahoo-finance2` — keep the same `YahooQuote` / `YahooError` / `resolveYahooSymbol` exports so `prices.ts` doesn't change shape.
- [ ] Drop `fetchYahooQuoteWithCrumb` (the lib handles consent/crumb internally).
- [ ] New `src/lib/services/prices-service.ts` — calls the Python sidecar via `PRICES_SERVICE_URL` (+ optional `PRICES_SERVICE_TOKEN`). Returns `PriceQuote` or throws `PricesServiceError`.
- [ ] `src/lib/services/prices.ts` orchestrator chain updated to: **prices-service (VPS) → yahoo (yahoo-finance2) → boursorama → twelve-data**. If `PRICES_SERVICE_URL` is unset, the prices-service step is skipped (not an error).
- [ ] `.env.example` updated with `PRICES_SERVICE_URL` and `PRICES_SERVICE_TOKEN` (both optional, documented).

### Python sidecar (`prices-service/` folder)

- [ ] `prices-service/main.py` — FastAPI app with:
  - `GET /health` → `{ "ok": true }`
  - `GET /quote?symbol=PE500.PA` → `{ symbol, price, currency, marketTime }`
  - `POST /quotes` body `{ "symbols": [...] }` → `{ quotes: [...], errors: [...] }` (parallel-batch via `yf.Tickers` or async)
  - Auth: optional `Authorization: Bearer <PRICES_SERVICE_TOKEN>` (env). If env unset → no auth required (dev mode).
  - CORS: allow Alex's Next.js origin via `ALLOWED_ORIGIN` env (default `*`).
- [ ] `prices-service/requirements.txt` — pinned versions for `yfinance`, `fastapi`, `uvicorn[standard]`.
- [ ] `prices-service/Dockerfile` — `python:3.12-slim`, copy code, expose 8000, `uvicorn main:app --host 0.0.0.0 --port 8000`.
- [ ] `prices-service/.dockerignore` — exclude `__pycache__`, `.venv`, etc.
- [ ] `prices-service/.env.example` — `PRICES_SERVICE_TOKEN=`, `ALLOWED_ORIGIN=`.
- [ ] `prices-service/README.md` — quickstart (local run + Dokploy deploy), API examples, how to set the token.

## Stack reuse

- ZapAction action shape unchanged.
- `prices.ts` orchestrator interface (`fetchPriceQuote(input)`) unchanged.
- Banner UI in `holdings-section.tsx` unchanged.

## Files to Change

### Next.js

**Edited (3)**
- `package.json` — `+ yahoo-finance2`
- `src/lib/services/yahoo-finance.ts` — full rewrite, ~50 lines
- `src/lib/services/prices.ts` — chain order + add prices-service step

**New (1)**
- `src/lib/services/prices-service.ts` — Python sidecar client

**Edited (1)**
- `.env.example` — `PRICES_SERVICE_URL`, `PRICES_SERVICE_TOKEN`

### Python sidecar (all new — new top-level folder)

- `prices-service/main.py`
- `prices-service/requirements.txt`
- `prices-service/Dockerfile`
- `prices-service/.dockerignore`
- `prices-service/.env.example`
- `prices-service/README.md`
- `prices-service/.gitignore`

→ **Total: 12 files** (8 new, 4 edited). Counted as one cohesive ship — splitting Python service from Next.js refactor would force placeholder code in between.

## Test Plan

- **Next.js**: `npx tsc --noEmit` clean, `npx eslint` clean. Set `PRICES_SERVICE_URL=` empty in `.env.local` → test refresh on PE500 → Yahoo via yahoo-finance2 should now succeed (it manages crumb).
- **Python service**: `cd prices-service && pip install -r requirements.txt && uvicorn main:app --reload` → curl `http://localhost:8000/health` → 200, `curl http://localhost:8000/quote?symbol=PE500.PA` → JSON with price.
- **Integrated**: Set `PRICES_SERVICE_URL=http://localhost:8000` in Next `.env.local` → restart Next dev → refresh holding → Network tab shows the request hits localhost:8000 first → if VPS down, Yahoo takes over.
- **Dokploy deploy**: build via Dokploy git integration. Set `PRICES_SERVICE_TOKEN` env in Dokploy. Update Next.js prod env to point `PRICES_SERVICE_URL` to the deployed URL.

## Open Questions (already settled by user)

1. ✅ Both yahoo-finance2 npm AND Python sidecar.
2. ✅ Python service deployed via Dokploy on Alex's VPS.
3. ✅ Service auth via bearer token (optional in dev, recommended in prod).
4. ✅ Service is the **primary** provider (chain head) — leverages different IP.

## Result

<!-- Filled after implementation -->

# prices-service

FastAPI microservice fronting `yfinance` to fetch real-time stock/ETF prices.
Used as the primary price provider by the `plan-financier` Next.js app.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — returns `{"ok": true}` |
| `GET` | `/quote?symbol=PE500.PA` | Fetch one quote |
| `POST` | `/quotes` body `{"symbols": [...]}` | Batch fetch (parallel, returns successes + errors) |

Auth: optional bearer token. If `PRICES_SERVICE_TOKEN` env is set, every request must include `Authorization: Bearer <token>`.

### Single-quote response

```json
{
  "symbol": "PE500.PA",
  "price": 50.20,
  "currency": "EUR",
  "marketTime": "2026-04-27"
}
```

### Batch response

```json
{
  "quotes": [{ "symbol": "PE500.PA", "price": 50.20, "currency": "EUR", "marketTime": "2026-04-27" }],
  "errors": [{ "symbol": "ZZZZZ", "reason": "No data for ZZZZZ." }]
}
```

## Local dev

```bash
cd prices-service
# macOS / Linux: use python3 if `python` isn't on PATH
python3 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **macOS note**: by default `python` doesn't exist (only `python3`). Use `python3` for the `venv` step. Once activated, `python` and `pip` inside the venv work normally.

Smoke test:
```bash
curl http://localhost:8000/health
curl "http://localhost:8000/quote?symbol=PE500.PA"
curl -X POST http://localhost:8000/quotes \
     -H "Content-Type: application/json" \
     -d '{"symbols":["PE500.PA","CW8.PA","AAPL"]}'
```

## Deploy on Dokploy

1. **New project → Application → Docker / Dockerfile** in your Dokploy panel.
2. Source: this folder (push it to a Git repo Dokploy can read, or upload).
3. Build context: `prices-service/`. Dockerfile: `Dockerfile`.
4. **Environment variables** (Dokploy UI):
   - `PRICES_SERVICE_TOKEN` — generate a random 32-byte string, e.g. `openssl rand -hex 32`.
   - `ALLOWED_ORIGIN` — your Next.js domain, e.g. `https://plan.example.com`. Use `*` only if you trust your network.
5. **Port mapping**: container port `8000` → public 80/443 via Dokploy's reverse proxy.
6. Deploy.

After the build finishes, hit `https://prices.<your-domain>/health` — should return `{"ok": true}`.

Then in the Next.js app `.env.local` (and Vercel env in prod), add:
```
PRICES_SERVICE_URL=https://prices.<your-domain>
PRICES_SERVICE_TOKEN=<the same token you set in Dokploy>
```

## Notes

- `yfinance` uses the same Yahoo Finance backend, but from your VPS IP — different from Vercel/your laptop, so it's not subject to the same rate-limit window.
- The container has no persistent state. Restarting it loses the in-memory `yfinance` session cache (~1 s rebuild).
- Free tier of Dokploy is fine for this; no egress is significant beyond a few KB per quote.
- Memory footprint: ~120 MB at idle, ~200 MB during a batch of 30 symbols. A 256 MB cap is enough.

"""
Prices microservice — yfinance-backed quote fetcher.

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Env:
    PRICES_SERVICE_TOKEN          Bearer token required on every request. MANDATORY at boot:
                                  the service refuses to start without it, unless
                                  PRICES_AUTH_DISABLED=1 is explicitly set (local dev only).
    PRICES_AUTH_DISABLED          Set to "1" to run with auth fully disabled (dev escape hatch).
    PRICES_CORS_ORIGINS           Comma-separated CORS origin allowlist. Default: no origin
                                  allowed (restrictive). Use "*" only if you trust your network.
    OTEL_EXPORTER_OTLP_ENDPOINT   Optional OTLP-HTTP traces endpoint (story 0-7 — ADR-0005).
    OTEL_SERVICE_NAME             Defaults to "pekulo-prices".

Compatible with Python 3.9+ (uses typing.Optional/Union/List/Dict instead of PEP 604/585).
"""

import asyncio
import os
import secrets
import sys
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import yfinance as yf
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
)


SERVICE_TOKEN = os.environ.get("PRICES_SERVICE_TOKEN", "").strip()
AUTH_DISABLED = os.environ.get("PRICES_AUTH_DISABLED", "").strip() == "1"
YF_IMPERSONATE = os.environ.get("YF_IMPERSONATE", "chrome").strip() or "chrome"
OTEL_OTLP_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
OTEL_SERVICE_NAME = os.environ.get("OTEL_SERVICE_NAME", "pekulo-prices").strip() or "pekulo-prices"

# Max symbols accepted in a single POST /quotes batch. Beyond this, pydantic
# rejects the request with 422 before any yfinance work is scheduled.
MAX_BATCH_SYMBOLS = 50

# Per-symbol wall-clock budget for a single yfinance fetch. yfinance has no
# clean per-call timeout knob, so we bound it at the executor level: a hung
# Yahoo call becomes a QuoteError instead of blocking the whole batch.
QUOTE_TIMEOUT_SECONDS = float(os.environ.get("PRICES_QUOTE_TIMEOUT", "10").strip() or "10")

# CORS allowlist. Default is restrictive: no origin is allowed unless
# PRICES_CORS_ORIGINS is set (comma-separated). "*" is honoured but must be
# opted into explicitly — it is no longer the default.
CORS_ORIGINS = [
    o.strip() for o in os.environ.get("PRICES_CORS_ORIGINS", "").split(",") if o.strip()
]


# M3 — env validation parity with apps/api's Zod gate. Fail loud at boot so
# a malformed OTEL_EXPORTER_OTLP_ENDPOINT does not silently fall back at
# runtime (story 0-7 review).
if OTEL_OTLP_ENDPOINT:
    _parsed = urlparse(OTEL_OTLP_ENDPOINT)
    if not _parsed.scheme or not _parsed.netloc:
        print(
            "[prices-service] invalid OTEL_EXPORTER_OTLP_ENDPOINT: {!r} is not a parseable URL".format(
                OTEL_OTLP_ENDPOINT
            ),
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)


# Auth fail-loud at boot — same pattern as the OTEL gate above. A missing
# PRICES_SERVICE_TOKEN previously made _check_auth a no-op, silently exposing
# the service. Now the import aborts unless auth is explicitly disabled for
# local dev via PRICES_AUTH_DISABLED=1.
if not SERVICE_TOKEN:
    if AUTH_DISABLED:
        print(
            "[prices-service] WARNING: auth DISABLED (PRICES_AUTH_DISABLED=1). "
            "Every request is accepted without a bearer token — local dev only, "
            "never run this in a shared or production environment.",
            file=sys.stderr,
            flush=True,
        )
    else:
        print(
            "[prices-service] FATAL: PRICES_SERVICE_TOKEN is required. "
            "Set it to a strong random secret, or set PRICES_AUTH_DISABLED=1 "
            "to run without auth in local dev.",
            file=sys.stderr,
            flush=True,
        )
        sys.exit(1)


# OTel init — runs at import time so the FastAPIInstrumentor below has a
# registered TracerProvider when it patches the app's route table.
_otel_provider = TracerProvider(resource=Resource.create({"service.name": OTEL_SERVICE_NAME}))
if OTEL_OTLP_ENDPOINT:
    _otel_exporter: Any = OTLPSpanExporter(endpoint=OTEL_OTLP_ENDPOINT)
else:
    _otel_exporter = ConsoleSpanExporter()
_otel_provider.add_span_processor(BatchSpanProcessor(_otel_exporter))
trace.set_tracer_provider(_otel_provider)


# yfinance is NOT auto-aware of curl_cffi. Without an explicit Session, requests go out
# with the stdlib User-Agent and TLS fingerprint, which Yahoo blocks aggressively from
# data-center IPs (the symptom is "Expecting value: line 1 column 1" — empty body on the
# crumb endpoint, then every history() call fails). Build a Chrome-impersonating session
# once at startup and reuse it for every Ticker.
try:
    from curl_cffi import requests as cffi_requests

    _yf_session = cffi_requests.Session(impersonate=YF_IMPERSONATE)
    print(
        "[prices-service] curl_cffi session ready (impersonate={})".format(YF_IMPERSONATE),
        file=sys.stderr,
        flush=True,
    )
except Exception as _e:  # noqa: BLE001
    _yf_session = None
    print(
        "[prices-service] curl_cffi unavailable ({}); falling back to default session — "
        "Yahoo will likely rate-limit from a VPS IP".format(_e),
        file=sys.stderr,
        flush=True,
    )

app = FastAPI(title="prices-service", version="1.0.0")

# CORS_ORIGINS defaults to [] (no browser origin allowed). The service is a
# server-to-server backend; an explicit allowlist via PRICES_CORS_ORIGINS is
# required to permit any browser origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# Patch the FastAPI app AFTER add_middleware so spans wrap the full middleware chain.
FastAPIInstrumentor.instrument_app(app)


class Quote(BaseModel):
    symbol: str
    price: float
    currency: str
    marketTime: str  # YYYY-MM-DD


class QuoteError(BaseModel):
    symbol: str
    reason: str


class BatchRequest(BaseModel):
    # Bounded batch: pydantic rejects >MAX_BATCH_SYMBOLS with 422 before any
    # yfinance fan-out, so a single request can't fan out unboundedly.
    symbols: List[str] = Field(..., max_length=MAX_BATCH_SYMBOLS)


class BatchResponse(BaseModel):
    quotes: List[Quote]
    errors: List[QuoteError]


def _check_auth(authorization: Optional[str]) -> None:
    # Auth is only skipped when explicitly disabled for local dev. Boot fails
    # loud (see top of module) if PRICES_SERVICE_TOKEN is unset without
    # PRICES_AUTH_DISABLED=1, so reaching here with no token means dev mode.
    if AUTH_DISABLED and not SERVICE_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = authorization[len("Bearer ") :].strip()
    # Constant-time comparison: avoids leaking the token via response timing.
    if not secrets.compare_digest(token, SERVICE_TOKEN):
        raise HTTPException(status_code=403, detail="Invalid token.")


def _format_date(ts: Any) -> str:
    if ts is None:
        return date.today().isoformat()
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(float(ts), tz=timezone.utc).date().isoformat()
    if isinstance(ts, datetime):
        return ts.date().isoformat()
    if isinstance(ts, date):
        return ts.isoformat()
    return str(ts)[:10]


def _quote_one(symbol: str) -> Quote:
    """Fetch one quote via yfinance.fast_info (cheap) and fall back to .history()."""
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=400, detail="Empty symbol.")

    ticker = yf.Ticker(sym, session=_yf_session) if _yf_session else yf.Ticker(sym)

    price: Optional[float] = None
    currency: str = ""
    market_time: Any = None

    try:
        info = ticker.fast_info
        # fast_info is dict-like in recent yfinance, attribute-like in older.
        try:
            price = info.get("last_price") or info.get("regular_market_price")
            currency = info.get("currency") or ""
            market_time = info.get("regular_market_time") or info.get("last_trade")
        except AttributeError:
            price = (
                getattr(info, "last_price", None)
                or getattr(info, "regular_market_price", None)
            )
            currency = getattr(info, "currency", "") or ""
            market_time = getattr(info, "regular_market_time", None) or getattr(
                info, "last_trade", None
            )
    except Exception:
        pass

    if price is None or float(price) <= 0:
        hist = ticker.history(period="1d", auto_adjust=False)
        if hist is None or hist.empty:
            raise HTTPException(status_code=404, detail="No data for {}.".format(sym))
        price = float(hist["Close"].iloc[-1])
        market_time = hist.index[-1]

    if price is None or float(price) <= 0:
        raise HTTPException(status_code=404, detail="No price for {}.".format(sym))

    if not currency:
        try:
            info_full = ticker.info
            currency = info_full.get("currency") or ""
        except Exception:
            currency = ""

    return Quote(
        symbol=sym,
        price=float(price),
        currency=str(currency or ""),
        marketTime=_format_date(market_time),
    )


@app.get("/health")
def health() -> Dict[str, bool]:
    return {"ok": True}


@app.get("/quote", response_model=Quote)
def get_quote(
    symbol: str = Query(..., min_length=1, max_length=24),
    authorization: Optional[str] = Header(default=None),
) -> Quote:
    _check_auth(authorization)
    return _quote_one(symbol)


@app.post("/quotes", response_model=BatchResponse)
async def post_quotes(
    body: BatchRequest,
    authorization: Optional[str] = Header(default=None),
) -> BatchResponse:
    _check_auth(authorization)
    if not body.symbols:
        return BatchResponse(quotes=[], errors=[])

    loop = asyncio.get_event_loop()

    async def _bounded(symbol: str) -> Union[Quote, QuoteError]:
        # asyncio.wait_for bounds each symbol independently so one slow Yahoo
        # response cannot stall the whole batch. The underlying executor thread
        # may keep running, but the response is no longer blocked on it.
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(None, _safe_quote_one, symbol),
                timeout=QUOTE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            return QuoteError(symbol=symbol, reason="Timeout fetching quote.")

    results = await asyncio.gather(*(_bounded(s) for s in body.symbols))

    quotes: List[Quote] = []
    errors: List[QuoteError] = []
    for r in results:
        if isinstance(r, Quote):
            quotes.append(r)
        else:
            errors.append(r)
    return BatchResponse(quotes=quotes, errors=errors)


def _safe_quote_one(symbol: str) -> Union[Quote, QuoteError]:
    try:
        return _quote_one(symbol)
    except HTTPException as e:
        return QuoteError(symbol=symbol, reason=str(e.detail))
    except Exception as e:  # noqa: BLE001
        return QuoteError(symbol=symbol, reason=str(e))

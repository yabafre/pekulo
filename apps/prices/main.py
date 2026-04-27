"""
Prices microservice — yfinance-backed quote fetcher.

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Env:
    PRICES_SERVICE_TOKEN  Bearer token required on every request (optional in dev).
    ALLOWED_ORIGIN        CORS origin allowlist, default '*'.

Compatible with Python 3.9+ (uses typing.Optional/Union/List/Dict instead of PEP 604/585).
"""

import asyncio
import os
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Union

import yfinance as yf
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


SERVICE_TOKEN = os.environ.get("PRICES_SERVICE_TOKEN", "").strip()
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*").strip() or "*"

app = FastAPI(title="prices-service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN] if ALLOWED_ORIGIN != "*" else ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class Quote(BaseModel):
    symbol: str
    price: float
    currency: str
    marketTime: str  # YYYY-MM-DD


class QuoteError(BaseModel):
    symbol: str
    reason: str


class BatchRequest(BaseModel):
    symbols: List[str]


class BatchResponse(BaseModel):
    quotes: List[Quote]
    errors: List[QuoteError]


def _check_auth(authorization: Optional[str]) -> None:
    if not SERVICE_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = authorization[len("Bearer ") :].strip()
    if token != SERVICE_TOKEN:
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

    ticker = yf.Ticker(sym)

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
    results = await asyncio.gather(
        *(loop.run_in_executor(None, _safe_quote_one, s) for s in body.symbols)
    )

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

"""Shared pytest fixtures for the prices microservice.

The auth gate and CORS allowlist are evaluated at module import time, so the
service token MUST be present in the environment before ``main`` is imported.
We set it here, at collection time, before any test module imports ``main``.
"""

import os
import sys

import pytest

# main.py lives one level up (apps/prices/main.py). Ensure it is importable
# regardless of pytest's rootdir/sys.path insertion mode.
_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)

# Test token — set before importing main so the boot-time auth gate passes
# and _check_auth has a token to compare against.
TEST_TOKEN = "test-token-secret"
os.environ.setdefault("PRICES_SERVICE_TOKEN", TEST_TOKEN)
# Keep tracing quiet/local during tests.
os.environ.pop("OTEL_EXPORTER_OTLP_ENDPOINT", None)

import main  # noqa: E402  (import after env is primed)

from fastapi.testclient import TestClient  # noqa: E402


class FakeFastInfo:
    """Dict-like fast_info matching the shape main._quote_one reads."""

    def __init__(self, data):
        self._data = data

    def get(self, key, default=None):
        return self._data.get(key, default)


class FakeTicker:
    """Stand-in for yfinance.Ticker that serves a canned quote via fast_info."""

    def __init__(self, symbol, session=None):
        self.symbol = symbol
        self.fast_info = FakeFastInfo(
            {"last_price": 50.20, "currency": "EUR", "regular_market_time": 1714000000}
        )
        self.info = {"currency": "EUR"}

    def history(self, *args, **kwargs):  # pragma: no cover - happy path uses fast_info
        raise AssertionError("history() should not be reached on the happy path")


@pytest.fixture(scope="session", autouse=True)
def _shutdown_otel():
    """Flush and shut down the OTel provider before pytest tears down its
    captured stdout, otherwise the BatchSpanProcessor's ConsoleSpanExporter
    tries to write to an already-closed file at interpreter exit."""
    yield
    provider = main.trace.get_tracer_provider()
    shutdown = getattr(provider, "shutdown", None)
    if callable(shutdown):
        shutdown()


@pytest.fixture()
def auth_header():
    return {"Authorization": "Bearer " + TEST_TOKEN}


@pytest.fixture()
def client(monkeypatch):
    """TestClient with auth enabled (token set) and yfinance fully mocked."""
    monkeypatch.setattr(main, "SERVICE_TOKEN", TEST_TOKEN)
    monkeypatch.setattr(main, "AUTH_DISABLED", False)
    monkeypatch.setattr(main.yf, "Ticker", FakeTicker)
    with TestClient(main.app) as c:
        yield c

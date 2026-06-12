"""Boot-time auth gate: the service must refuse to start without a token,
unless auth is explicitly disabled for local dev.

Each case imports ``main`` in a fresh subprocess so the import-time
``sys.exit(1)`` is observable as a non-zero exit code.
"""

import os
import subprocess
import sys

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMPORT_SNIPPET = "import main"


def _run_import(extra_env):
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in ("PRICES_SERVICE_TOKEN", "PRICES_AUTH_DISABLED")
    }
    env.update(extra_env)
    env.setdefault("PYTHONPATH", APP_DIR)
    return subprocess.run(
        [sys.executable, "-c", IMPORT_SNIPPET],
        cwd=APP_DIR,
        env=env,
        capture_output=True,
        text=True,
    )


def test_boot_refuses_without_token():
    result = _run_import({})
    assert result.returncode == 1, result.stderr
    assert "PRICES_SERVICE_TOKEN is required" in result.stderr


def test_boot_allows_disabled_auth():
    result = _run_import({"PRICES_AUTH_DISABLED": "1"})
    assert result.returncode == 0, result.stderr
    assert "auth DISABLED" in result.stderr


def test_boot_succeeds_with_token():
    result = _run_import({"PRICES_SERVICE_TOKEN": "some-strong-secret"})
    assert result.returncode == 0, result.stderr

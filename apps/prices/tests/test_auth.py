"""Auth gate behaviour: token required, constant-time comparison."""

import main


def test_quote_without_token_is_401(client):
    resp = client.get("/quote", params={"symbol": "PE500.PA"})
    assert resp.status_code == 401


def test_quote_with_wrong_token_is_403(client):
    resp = client.get(
        "/quote",
        params={"symbol": "PE500.PA"},
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert resp.status_code == 403


def test_quote_with_correct_token_is_200(client, auth_header):
    resp = client.get("/quote", params={"symbol": "PE500.PA"}, headers=auth_header)
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "PE500.PA"
    assert body["price"] == 50.20
    assert body["currency"] == "EUR"


def test_malformed_authorization_header_is_401(client):
    resp = client.get(
        "/quote",
        params={"symbol": "PE500.PA"},
        headers={"Authorization": "test-token-secret"},  # missing "Bearer "
    )
    assert resp.status_code == 401


def test_check_auth_uses_constant_time_compare(monkeypatch):
    """_check_auth must route token comparison through secrets.compare_digest."""
    calls = {}
    real_compare = main.secrets.compare_digest

    def spy(a, b):
        calls["args"] = (a, b)
        return real_compare(a, b)

    monkeypatch.setattr(main, "SERVICE_TOKEN", "the-token")
    monkeypatch.setattr(main, "AUTH_DISABLED", False)
    monkeypatch.setattr(main.secrets, "compare_digest", spy)

    main._check_auth("Bearer the-token")  # should not raise
    assert calls["args"] == ("the-token", "the-token")

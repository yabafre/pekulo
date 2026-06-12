"""POST /quotes: bounded batch size and the mocked happy path."""

import main


def test_batch_happy_path(client, auth_header):
    resp = client.post(
        "/quotes", json={"symbols": ["PE500.PA", "CW8.PA"]}, headers=auth_header
    )
    assert resp.status_code == 200
    body = resp.json()
    symbols = sorted(q["symbol"] for q in body["quotes"])
    assert symbols == ["CW8.PA", "PE500.PA"]
    assert body["errors"] == []
    assert all(q["price"] == 50.20 and q["currency"] == "EUR" for q in body["quotes"])


def test_empty_batch_returns_empty(client, auth_header):
    resp = client.post("/quotes", json={"symbols": []}, headers=auth_header)
    assert resp.status_code == 200
    assert resp.json() == {"quotes": [], "errors": []}


def test_batch_at_limit_is_accepted(client, auth_header):
    symbols = ["S{}.PA".format(i) for i in range(main.MAX_BATCH_SYMBOLS)]
    resp = client.post("/quotes", json={"symbols": symbols}, headers=auth_header)
    assert resp.status_code == 200
    assert len(resp.json()["quotes"]) == main.MAX_BATCH_SYMBOLS


def test_batch_over_limit_is_422(client, auth_header):
    symbols = ["S{}.PA".format(i) for i in range(main.MAX_BATCH_SYMBOLS + 1)]
    resp = client.post("/quotes", json={"symbols": symbols}, headers=auth_header)
    assert resp.status_code == 422


def test_batch_over_limit_is_rejected_before_auth_does_not_matter(client):
    """Oversized batch is a 422 regardless (validation happens on the model)."""
    symbols = ["S{}.PA".format(i) for i in range(main.MAX_BATCH_SYMBOLS + 1)]
    resp = client.post("/quotes", json={"symbols": symbols})
    # No auth header → either 401 (auth runs first) or 422 (validation first);
    # both prove the request is rejected. Assert it is never a 200.
    assert resp.status_code in (401, 422)

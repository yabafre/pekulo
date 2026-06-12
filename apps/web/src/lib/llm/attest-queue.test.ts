// apps/web/src/lib/llm/attest-queue.test.ts
// Story 6-6 (ADR-0008 W3). The producer is dormant in V1(a) web, so the queue
// is exercised entirely by a fake transport + an injected clock + simulated
// `online` events. fake-indexeddb/auto installs a real IndexedDB on the
// happy-dom global (happy-dom ships none). deleteDB resets state per test.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { deleteDB } from "idb";
import { ATTEST_DB_NAME, EVENTS_STORE, METRICS_STORE, openAttestDb } from "./attest-db";
import { createAttestQueue, SEVEN_DAYS_MS, type AttestEvent } from "./attest-queue";

const USER = "user_alex";

function event(over: Partial<AttestEvent> = {}): AttestEvent {
  return {
    callId: "call_1",
    route: "foundation_models",
    latencyMs: 120,
    outcome: "success",
    labelHash: "h_abc",
    ...over,
  };
}

// A controllable clock so the 7-day window is deterministic.
function clock(start: number) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

async function eventRows(user = USER) {
  const db = await openAttestDb();
  return db.getAllFromIndex(EVENTS_STORE, "byUser", user);
}

beforeEach(async () => {
  await deleteDB(ATTEST_DB_NAME);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("attest-queue (story 6-6)", () => {
  test("AC-1 — enqueue persists a valid event that survives re-instantiation", async () => {
    const c = clock(1_000_000);
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true }));
    const q = createAttestQueue({ userId: USER, submit, now: c.now });
    await q.enqueue(event());

    // A fresh DB handle (simulating a page reload) still sees the row.
    const rows = await eventRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload.callId).toBe("call_1");
    expect(submit).not.toHaveBeenCalled(); // enqueue does not auto-flush
  });

  test("AC-1 — a schema-invalid event is rejected and not persisted", async () => {
    const c = clock(1_000_000);
    const q = createAttestQueue({ userId: USER, submit: vi.fn(), now: c.now });
    // route must be the foundation_models literal — ollama is rejected.
    await expect(q.enqueue(event({ route: "ollama" as never }))).rejects.toThrow();
    expect(await eventRows()).toHaveLength(0);
  });

  test("AC-2 — a failed attestation retries and recovers on the next flush", async () => {
    const c = clock(1_000_000);
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true }));
    submit.mockResolvedValueOnce({ ok: false }); // first attempt: offline / 5xx
    const q = createAttestQueue({ userId: USER, submit, now: c.now, backoff: { jitter: false } });
    await q.enqueue(event());

    await q.flush(); // attempt 1 fails → backed off, still queued
    expect(await eventRows()).toHaveLength(1);

    c.advance(2000); // past the base*factor^1 = 2000 ms backoff
    await q.flush(); // attempt 2 succeeds → removed + flushed metric
    expect(await eventRows()).toHaveLength(0);

    const stats = await q.getStats();
    expect(stats.flushed).toBe(1);
    expect(stats.dropRate).toBe(0);
  });

  test("AC-2 — an `online` event triggers a flush", async () => {
    const c = clock(1_000_000);
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true }));
    const q = createAttestQueue({ userId: USER, submit, now: c.now });
    await q.enqueue(event());
    q.start();
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(async () => {
      expect(await eventRows()).toHaveLength(0);
    });
    q.stop();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  test("AC-3 — an undeliverable event older than 7 days is dropped", async () => {
    const c = clock(1_000_000);
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: false }));
    const q = createAttestQueue({ userId: USER, submit, now: c.now, backoff: { jitter: false } });
    await q.enqueue(event());
    c.advance(SEVEN_DAYS_MS + 1);
    await q.flush();
    expect(await eventRows()).toHaveLength(0);

    const stats = await q.getStats();
    expect(stats.dropped).toBe(1);
    expect(stats.dropRate).toBe(1);
  });

  test("AC-4 — onAlert fires exactly once when the 7-day drop rate crosses 1 %", async () => {
    const c = clock(1_000_000);
    const onAlert = vi.fn();
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true }));
    const q = createAttestQueue({
      userId: USER,
      submit,
      now: c.now,
      onAlert,
      backoff: { jitter: false },
    });

    // Two events that will age out into drops. Enqueued at t0, never delivered.
    await q.enqueue(event({ callId: "drop_1" }));
    await q.enqueue(event({ callId: "drop_2" }));
    expect(onAlert).not.toHaveBeenCalled(); // nothing terminal yet

    // Move the clock past 7 days, then enqueue 99 events that flush cleanly NOW.
    c.advance(SEVEN_DAYS_MS + 1);
    for (let i = 0; i < 99; i += 1) {
      await q.enqueue(event({ callId: `ok_${i}` }));
    }
    // One flush: drop_1 / drop_2 age-evicted (2 dropped), the 99 delivered.
    // Window now holds 99 flushed + 2 dropped → 2/101 ≈ 1.98 % > 1 %.
    await q.flush();
    expect(onAlert).toHaveBeenCalledTimes(1);

    // Staying above threshold does not re-alert (edge-triggered).
    await q.flush();
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test("AC-5 — concurrent flush is a no-op; clearForUser purges the user", async () => {
    const c = clock(1_000_000);
    let inFlight = 0;
    let maxInFlight = 0;
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true };
    });
    const q = createAttestQueue({ userId: USER, submit, now: c.now });
    await q.enqueue(event({ callId: "a" }));
    await q.enqueue(event({ callId: "b" }));
    await Promise.all([q.flush(), q.flush()]); // second call returns immediately
    expect(maxInFlight).toBe(1);
    expect(await eventRows()).toHaveLength(0);

    await q.enqueue(event({ callId: "c" }));
    await q.clearForUser();
    const db = await openAttestDb();
    expect(await db.getAllFromIndex(EVENTS_STORE, "byUser", USER)).toHaveLength(0);
    expect(await db.getAllFromIndex(METRICS_STORE, "byUser", USER)).toHaveLength(0);
  });

  test("AC-1 — enqueue records an `enqueued` metric", async () => {
    const c = clock(1_000_000);
    const q = createAttestQueue({
      userId: USER,
      submit: vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true })),
      now: c.now,
    });
    await q.enqueue(event());
    const db = await openAttestDb();
    const metrics = await db.getAllFromIndex(METRICS_STORE, "byUser", USER);
    expect(metrics.filter((m) => m.type === "enqueued")).toHaveLength(1);
  });

  test("AC-4 — re-arms after the rate falls back ≤ 1 % and fires again on the next crossing", async () => {
    const c = clock(1_000_000);
    const onAlert = vi.fn();
    let deliver = false;
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: deliver }));
    const q = createAttestQueue({
      userId: USER,
      submit,
      now: c.now,
      onAlert,
      backoff: { jitter: false },
    });

    // (1) one event ages out → 1 dropped / 0 flushed = 100 % > 1 % → alert #1.
    await q.enqueue(event({ callId: "d1" }));
    c.advance(SEVEN_DAYS_MS + 1);
    await q.flush();
    expect(onAlert).toHaveBeenCalledTimes(1);

    // (2) 200 clean deliveries pull the in-window rate to 1/201 ≈ 0.5 % ≤ 1 % → re-arm.
    deliver = true;
    for (let i = 0; i < 200; i += 1) {
      await q.enqueue(event({ callId: `ok_${i}` }));
    }
    await q.flush();
    expect(onAlert).toHaveBeenCalledTimes(1); // fell back under threshold — no new alert

    // (3) advance past the window so (2)'s flushes age out of it, then 3 fresh
    // events age out → 3 dropped / 0 in-window flushed = 100 % > 1 % → alert #2.
    deliver = false;
    for (let i = 0; i < 3; i += 1) {
      await q.enqueue(event({ callId: `d2_${i}` }));
    }
    c.advance(SEVEN_DAYS_MS + 1);
    await q.flush();
    expect(onAlert).toHaveBeenCalledTimes(2);
  });

  test("AC-5 — start()/stop() add/remove the `online` listener idempotently", async () => {
    const c = clock(1_000_000);
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => ({ ok: true }));
    const q = createAttestQueue({ userId: USER, submit, now: c.now });
    await q.enqueue(event());

    q.start();
    q.start(); // idempotent — must NOT register a second `online` listener
    const onlineAdds = addSpy.mock.calls.filter(([type]) => type === "online").length;
    expect(onlineAdds).toBe(1);

    window.dispatchEvent(new Event("online"));
    await vi.waitFor(async () => {
      expect(await eventRows()).toHaveLength(0);
    });
    expect(submit).toHaveBeenCalledTimes(1);

    q.stop();
    q.stop(); // idempotent — safe to call twice, removes the listener once
    const onlineRemoves = removeSpy.mock.calls.filter(([type]) => type === "online").length;
    expect(onlineRemoves).toBe(1);
  });

  test("AC-5 — two queue instances for the same user never double-submit a row", async () => {
    const c = clock(1_000_000);
    let inFlight = 0;
    let maxInFlight = 0;
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true };
    });
    const q1 = createAttestQueue({ userId: USER, submit, now: c.now });
    const q2 = createAttestQueue({ userId: USER, submit, now: c.now });
    await q1.enqueue(event({ callId: "a" }));
    await q1.enqueue(event({ callId: "b" }));
    // The per-user guard is shared across instances → only one drains.
    await Promise.all([q1.flush(), q2.flush()]);
    expect(maxInFlight).toBe(1);
    expect(await eventRows()).toHaveLength(0);
  });

  test("AC-5 — a connection closed mid-drain ends the flush cleanly", async () => {
    const c = clock(1_000_000);
    // submit closes the shared connection (as a versionchange / deleteDB would)
    // right before the queue evicts the delivered row, so the eviction runs
    // against a dead handle.
    const submit = vi.fn(async (_e: AttestEvent): Promise<{ ok: boolean }> => {
      (await openAttestDb()).close();
      return { ok: true };
    });
    const q = createAttestQueue({ userId: USER, submit, now: c.now });
    await q.enqueue(event());
    // No throw, no unhandled rejection — the drain aborts and reopens next window.
    await expect(q.flush()).resolves.toBeUndefined();
    // Proof the eviction was aborted (not a no-op close): the row survives,
    // uncommitted, for the next window rather than being silently dropped.
    expect(await eventRows()).toHaveLength(1);
  });
});

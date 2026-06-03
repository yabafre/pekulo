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
    expect(rows[0].payload.callId).toBe("call_1");
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
});

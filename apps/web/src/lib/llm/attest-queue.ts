// apps/web/src/lib/llm/attest-queue.ts
// Durable client-side attestation retry queue (story 6-6, ADR-0008 W3).
//
// THE PRODUCER IS DORMANT IN V1(a) WEB. On the web tier
// clientCapabilities.iosFoundationModels is always false, so categorisation
// routes to Ollama and the SERVER writes both audit rows itself — nothing calls
// enqueue() in prod yet. The real producer is the iOS on-device
// FoundationModels client (V1.5 mobile, story 10-2), which renders a suggestion
// immediately and attests async via this queue. This module ships the tested
// primitive + the W3 drop-rate instrumentation now; the live wiring lands with
// the mobile app.
//
// Injected seams (story 6-6 Dev Notes):
//   • submit  (D2) — transport; the lib never hardcodes endpoint/auth, so it is
//                    portable web+mobile and testable offline. Default posts to
//                    /internal/llm/attest.
//   • now     (D3) — clock, so the 7-day window is deterministic in tests.
//   • onAlert (D6) — W3 alert sink (default console.warn) because
//                    lib/otel/tracer.ts is server-only and no client metric
//                    sink exists yet.
// Every enqueue is validated against attestLlmCallSchema — the SAME schema the
// server enforces — so a malformed event can't reach the durable store and
// client/server stay drift-locked.
import { attestLlmCallSchema } from "@pekulo/validators";
import {
  EVENTS_STORE,
  METRICS_STORE,
  openAttestDb,
  type AttestRecord,
  type MetricType,
} from "./attest-db";

export interface AttestEvent {
  callId: string;
  route: "foundation_models";
  latencyMs: number;
  outcome: "success" | "failure";
  labelHash: string;
}

export interface AttestQueueStats {
  /** Successful flushes within the rolling 7-day window. */
  flushed: number;
  /** Permanently abandoned events within the rolling 7-day window. */
  dropped: number;
  /** dropped / (flushed + dropped); 0 when the denominator is 0. */
  dropRate: number;
}

export interface BackoffConfig {
  baseMs: number;
  factor: number;
  maxDelayMs: number;
  /** Max delivery attempts before an event is parked for the next window. */
  maxAttempts: number;
  /** Add ±50 % jitter to each delay. Disable for deterministic tests. */
  jitter: boolean;
}

export interface AttestQueueDeps {
  /** Scopes every store read / write; also the logout purge key. */
  userId: string;
  /** Delivers one attestation. Default posts to /internal/llm/attest. */
  submit?: (event: AttestEvent) => Promise<{ ok: boolean }>;
  /** Clock seam (default Date.now). */
  now?: () => number;
  /** W3 alert sink, fired once per ≤1 %→>1 % crossing (default console.warn). */
  onAlert?: (stats: AttestQueueStats) => void;
  backoff?: Partial<BackoffConfig>;
  /** Override the attest endpoint for the default transport. */
  endpoint?: string;
  /** Bearer-token supplier for the default transport. */
  getAuthToken?: () => Promise<string | null>;
}

export interface AttestQueue {
  enqueue(event: AttestEvent): Promise<void>;
  flush(): Promise<void>;
  start(): void;
  stop(): void;
  getStats(): Promise<AttestQueueStats>;
  clearForUser(): Promise<void>;
}

/** Rolling window + W3 pivot threshold (ADR-0008: pivot to synchronous attest
 * if the drop rate exceeds 1 % over a rolling 7-day window). */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const W3_DROP_THRESHOLD = 0.01;

const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 1000,
  factor: 2,
  maxDelayMs: 30_000,
  maxAttempts: 5,
  jitter: true,
};

const DEFAULT_ENDPOINT = "/internal/llm/attest";

function defaultSubmit(
  endpoint: string,
  getAuthToken?: () => Promise<string | null>,
): (event: AttestEvent) => Promise<{ ok: boolean }> {
  return async (event) => {
    const token = getAuthToken ? await getAuthToken() : null;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(event),
      keepalive: true,
    });
    // 204 = recorded. Any non-2xx is treated uniformly as "not delivered" and
    // left to backoff / age-eviction (a forged or invalid event is dropped on
    // age, never looped forever). res.ok covers 200-299.
    return { ok: res.ok };
  };
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function createAttestQueue(deps: AttestQueueDeps): AttestQueue {
  const userId = deps.userId;
  const now = deps.now ?? (() => Date.now());
  const onAlert =
    deps.onAlert ??
    ((stats: AttestQueueStats) =>
      console.warn("[attest-queue] W3 drop-rate threshold crossed", stats));
  const backoff: BackoffConfig = { ...DEFAULT_BACKOFF, ...deps.backoff };
  const submit = deps.submit ?? defaultSubmit(deps.endpoint ?? DEFAULT_ENDPOINT, deps.getAuthToken);

  let flushing = false;
  let alertedAbove = false;
  let onlineHandler: (() => void) | null = null;

  async function recordMetric(type: MetricType): Promise<void> {
    const db = await openAttestDb();
    await db.add(METRICS_STORE, { userId, type, ts: now() });
  }

  function backoffDelay(attempts: number): number {
    const raw = Math.min(backoff.baseMs * backoff.factor ** attempts, backoff.maxDelayMs);
    if (!backoff.jitter) return raw;
    // ±50 % jitter spreads fleet retries so reconnect doesn't thunder.
    return raw * (0.5 + Math.random());
  }

  async function enqueue(event: AttestEvent): Promise<void> {
    // Validate against the SAME schema the server enforces — a malformed event
    // never reaches the durable store (AC-1). Throws on invalid.
    const parsed = attestLlmCallSchema.parse(event);
    const record: AttestRecord = {
      userId,
      payload: {
        callId: parsed.callId,
        route: parsed.route,
        latencyMs: parsed.latencyMs,
        outcome: parsed.outcome,
        labelHash: parsed.labelHash,
      },
      enqueuedAt: now(),
      attempts: 0,
      nextAttemptAt: now(),
    };
    try {
      const db = await openAttestDb();
      await db.add(EVENTS_STORE, record);
    } catch (err) {
      // Storage full → immediate drop (AC-3 / edge case): the event is lost, so
      // it counts toward the W3 drop-rate and may fire the alert.
      if (isQuotaError(err)) {
        await recordMetric("dropped");
        await maybeAlert();
        return;
      }
      throw err;
    }
    await recordMetric("enqueued");
  }

  async function flush(): Promise<void> {
    if (flushing) return; // AC-5: never two concurrent drains.
    flushing = true;
    try {
      const db = await openAttestDb();
      await pruneOldMetrics(db);
      const records = await db.getAllFromIndex(EVENTS_STORE, "byUser", userId);
      for (const record of records) {
        if (record.id === undefined) continue;
        // Drop-on-age: an event still undeliverable after 7 days is abandoned
        // (AC-3) — it counts as a drop and is evicted.
        if (now() - record.enqueuedAt > SEVEN_DAYS_MS) {
          await db.delete(EVENTS_STORE, record.id);
          await recordMetric("dropped");
          continue;
        }
        if (now() < record.nextAttemptAt) continue; // still backing off
        let delivered = false;
        try {
          const result = await submit({ ...record.payload });
          delivered = result.ok;
        } catch {
          delivered = false;
        }
        if (delivered) {
          await db.delete(EVENTS_STORE, record.id);
          await recordMetric("flushed"); // AC-2 recovery is recorded
          continue;
        }
        const attempts = record.attempts + 1;
        if (attempts >= backoff.maxAttempts) {
          // Park for the next online window — DON'T drop yet (age decides).
          await db.put(EVENTS_STORE, {
            ...record,
            attempts: 0,
            nextAttemptAt: now() + backoff.maxDelayMs,
          });
        } else {
          await db.put(EVENTS_STORE, {
            ...record,
            attempts,
            nextAttemptAt: now() + backoffDelay(attempts),
          });
        }
      }
      await maybeAlert();
    } finally {
      flushing = false;
    }
  }

  async function pruneOldMetrics(db: Awaited<ReturnType<typeof openAttestDb>>): Promise<void> {
    // Housekeeping: metric rows outside the rolling window can never affect
    // getStats again, so evict them to keep the store bounded.
    const cutoff = now() - SEVEN_DAYS_MS;
    const rows = await db.getAllFromIndex(METRICS_STORE, "byUser", userId);
    const stale = rows.filter((m) => m.ts < cutoff && m.id !== undefined);
    if (stale.length === 0) return;
    const tx = db.transaction(METRICS_STORE, "readwrite");
    await Promise.all(stale.map((m) => tx.store.delete(m.id as number)));
    await tx.done;
  }

  async function getStats(): Promise<AttestQueueStats> {
    const db = await openAttestDb();
    const metrics = await db.getAllFromIndex(METRICS_STORE, "byUser", userId);
    const cutoff = now() - SEVEN_DAYS_MS;
    let flushed = 0;
    let dropped = 0;
    for (const m of metrics) {
      if (m.ts < cutoff) continue;
      if (m.type === "flushed") flushed += 1;
      else if (m.type === "dropped") dropped += 1;
    }
    const terminal = flushed + dropped;
    const dropRate = terminal === 0 ? 0 : dropped / terminal;
    return { flushed, dropped, dropRate };
  }

  async function maybeAlert(): Promise<void> {
    const stats = await getStats();
    if (stats.dropRate > W3_DROP_THRESHOLD) {
      if (!alertedAbove) {
        alertedAbove = true;
        onAlert(stats); // AC-4: edge-triggered, once per crossing.
      }
    } else {
      alertedAbove = false; // re-arm once back under threshold
    }
  }

  function start(): void {
    if (onlineHandler) return; // idempotent (AC-5)
    onlineHandler = () => {
      void flush();
    };
    if (typeof window !== "undefined") window.addEventListener("online", onlineHandler);
  }

  function stop(): void {
    if (onlineHandler && typeof window !== "undefined") {
      window.removeEventListener("online", onlineHandler);
    }
    onlineHandler = null;
  }

  async function clearForUser(): Promise<void> {
    const db = await openAttestDb();
    for (const store of [EVENTS_STORE, METRICS_STORE] as const) {
      const keys = await db.getAllKeysFromIndex(store, "byUser", userId);
      const tx = db.transaction(store, "readwrite");
      await Promise.all(keys.map((k) => tx.store.delete(k)));
      await tx.done;
    }
  }

  return { enqueue, flush, start, stop, getStats, clearForUser };
}

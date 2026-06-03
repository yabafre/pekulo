// apps/web/src/lib/llm/attest-db.ts
// Durable IndexedDB store for the FoundationModels attestation queue (story
// 6-6, ADR-0008 W3). Browser-only. Opens the `pekulo-llm-attest` database with
// two object stores:
//   • `events`  — one record per queued attestation, scoped by userId, retried
//                 until flushed (delivered) or dropped (age > 7d / quota).
//   • `metrics` — an append-only log of {ts, type} terminal events
//                 (enqueued | flushed | dropped) — the source of the W3
//                 rolling-7-day drop-rate.
// No PII is ever stored: an attestation carries only callId, route, latencyMs,
// outcome and a label HASH (NFR-26). So unlike the ADR-0003 offline cache (9-2,
// not yet built) this store is NOT encrypted; it IS scoped per userId so a
// second account on the same browser can't read or flush the first's queue.
// `idb` is the thin promise wrapper over the raw IndexedDB request API (D1).
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const ATTEST_DB_NAME = "pekulo-llm-attest";
export const ATTEST_DB_VERSION = 1;
export const EVENTS_STORE = "events";
export const METRICS_STORE = "metrics";

/** A queued attestation plus the retry bookkeeping the queue needs. `payload`
 * is exactly the body POSTed to /internal/llm/attest. */
export interface AttestRecord {
  /** Auto-increment primary key (assigned by IndexedDB on add). */
  id?: number;
  userId: string;
  payload: {
    callId: string;
    route: "foundation_models";
    latencyMs: number;
    outcome: "success" | "failure";
    labelHash: string;
  };
  enqueuedAt: number;
  attempts: number;
  /** Epoch ms before which the queue must not retry this record (backoff). */
  nextAttemptAt: number;
}

export type MetricType = "enqueued" | "flushed" | "dropped";

export interface MetricRecord {
  id?: number;
  userId: string;
  type: MetricType;
  ts: number;
}

interface AttestDb extends DBSchema {
  events: { key: number; value: AttestRecord; indexes: { byUser: string } };
  metrics: { key: number; value: MetricRecord; indexes: { byUser: string } };
}

// One memoised connection for the whole tab — this is the "single connection
// promise" the queue relies on. idb does NOT auto-close on a versionchange, so
// without a `blocking` handler a stray open connection blocks any future
// deleteDB / schema bump indefinitely (it also leaks a connection per call).
// On `blocking` we release the connection so the waiting operation proceeds,
// then reopen lazily on the next call.
let dbPromise: Promise<IDBPDatabase<AttestDb>> | null = null;

/** Open (and migrate on first use) the attestation database. Both stores key
 * on an auto-increment `id` and carry a `byUser` index so every read / delete
 * is scoped to one userId. The single connection promise is memoised here and
 * released on `blocking` / `terminated` so a deleteDB never deadlocks. */
export function openAttestDb(): Promise<IDBPDatabase<AttestDb>> {
  if (dbPromise) return dbPromise;
  const promise = openDB<AttestDb>(ATTEST_DB_NAME, ATTEST_DB_VERSION, {
    upgrade(db) {
      const events = db.createObjectStore(EVENTS_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      events.createIndex("byUser", "userId");
      const metrics = db.createObjectStore(METRICS_STORE, {
        keyPath: "id",
        autoIncrement: true,
      });
      metrics.createIndex("byUser", "userId");
    },
    blocking() {
      void promise.then((db) => db.close());
      if (dbPromise === promise) dbPromise = null;
    },
    terminated() {
      if (dbPromise === promise) dbPromise = null;
    },
  });
  dbPromise = promise;
  return promise;
}

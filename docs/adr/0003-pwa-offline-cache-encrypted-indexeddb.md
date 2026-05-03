# PWA offline cache — encrypted IndexedDB scoped per user

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

FR-54 requires read-only views of `dashboard`, `portefeuille`, `immobilier` to render from the last cached snapshot when Supabase is unreachable. NFR-8 enforces server-side RLS as the _only_ authorisation surface. Persisting any user data on-device must not weaken that posture.

## Decision

Cache snapshots in **IndexedDB encrypted with a key derived from the active Supabase session via Web Crypto** (`SubtleCrypto.deriveKey`). Cache is partitioned by `user_id` (database name = `pekulo-cache-<user_id>`). On `auth.onAuthStateChange('SIGNED_OUT')` the database is deleted unconditionally. Cache TTL = 60 min (NFR-20). Service Worker strategy = stale-while-revalidate on the three offline-eligible routes ; network-first on every mutation.

## Why

- **FR-54** — read-only views must survive backend unavailability.
- **NFR-8 / NFR-20** — IndexedDB Cache API alone would persist plaintext PII ; encryption at rest preserves the "no PII at rest outside Supabase" posture.
- **DR-4 (RLS coverage)** — partition-by-user prevents accidental cross-user reads on a shared device.

## Considered options

- **Cache API only (Service Worker `caches`)** — rejected: stores response bodies in plaintext on disk.
- **IndexedDB unencrypted** — rejected: same plaintext-at-rest issue, plus survives sign-out.
- **`next-pwa`** — rejected: lags Next 16 ; opaque SW abstractions ; we want the SW under our direct control to enforce the encryption + per-user partition rules.

## Consequences

- Adds a small key-derivation cost (~5–10 ms) on first cache write per session.
- DS / forms code MUST treat Zustand `persist` and IndexedDB cache as different buckets — secrets never persisted (Phase 3 process rule).

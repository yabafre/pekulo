# Runtime language — TypeScript only; Rust adoption gated by a measured trigger

**Date:** 2026-11-27
**Status:** accepted
**Decided by:** Alex (decided without Council — reversible policy; recorded for the "why not Rust?" question)
**Source:** `docs/spikes/2026-11-26-securite-chiffrement-rust.md` § 5 · `docs/architecture.md` § Amendment 2026-11-27

## Context

Rust was proposed "for performance in some places". Pekulo's compute is small: the deterministic projection modules in `apps/api/src/common/derive/` are under 100 lines each, and the verdict is computed once server-side and served to web, PWA and mobile through oRPC, so cross-surface consistency is already guaranteed. Measured on Bun: a worst-case Monte Carlo (10 000 paths × 480 months) takes 70–95 ms; AES-256-GCM decryption costs 0.7 µs per field. Observed latency comes from I/O (Postgres, Bridge, price providers), not CPU.

## Decision

Stay **TypeScript-only** across `apps/api`, `apps/web`, `apps/mobile` and `packages/*`. Rust may be introduced only when **one** trigger is met and recorded in a new ADR that cites the measurement:

1. **Measured CPU bottleneck** — a p95 above the NFR-1, NFR-15 or NFR-16 budget (or M1) **and** a profile showing the time is CPU, not I/O.
2. **On-device compute need** — a product requirement to compute on the device (client-side "private vault" from ADR-0019's residual gap, offline projections).

When triggered, the shape is fixed: one Rust crate exposed to React Native as a native Turbo Module via `uniffi-bindgen-react-native`, and to the web through `wasm-bindgen`. WebAssembly is **not** used inside the React Native app until Hermes support is confirmed for production. **No custom cryptography in Rust** — cryptography stays on `node:crypto`, WebCrypto or libsodium.

## Why

A second toolchain costs a solo founder build, CI, review and hiring complexity for a gain users cannot perceive under the current budgets (NFR-1, NFR-15, NFR-16, M1). The trigger keeps the door open where Rust brings real value: one shared engine when computation must leave the server.

## Considered options

- **Rust for the projection engine now** — rejected: 70–95 ms worst case is within budget; no on-device compute requirement exists.
- **Rust/WASM shared engine for web + mobile now** — rejected: the server already guarantees consistency; Hermes WebAssembly is not confirmed for production apps.
- **Rust rewrite of `apps/prices`** — rejected: that service is I/O-bound (provider calls).

## Consequences

- Performance work starts with profiling and I/O fixes (queries, caching, batching) before any language change.
- A story that proposes Rust without a trigger measurement is rejected at review.

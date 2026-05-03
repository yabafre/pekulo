# Audit history via sister tables, not JSONB columns

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

Two PRD requirements demand append-only audit trails: FR-2 (compass values archived on every edit) and FR-27 (real-estate property valuations preserved on every revaluation). Two viable encodings: (a) sister tables (`compass_history`, `real_estate_valuations`) keyed by `(user_id, valued_on desc)`, or (b) JSONB `history` column appended to the parent row.

## Decision

Sister tables. `compass_history` is an append-only sibling of `hypotheses` ; `real_estate_valuations` is an append-only sibling of `real_estate`. Every parent-row edit writes the prior values into the sister table within the same transaction.

## Why

- **NFR-1 (compass progress p95 < 300 ms)** — `current_compass()` and `current_valuation()` reads stay O(1) on the parent row. JSONB append would force a `jsonb_array_elements + ORDER BY` scan on every dashboard render.
- **FR-2, FR-27** — sister tables make audit queries trivial and indexable on `(user_id, valued_on desc)`.
- **DR-5 (cascade deletion within 60 s)** — sister tables cascade naturally via `ON DELETE CASCADE` from `auth.users(id)` ; JSONB columns offer no per-row deletion control if the schema later needs it.

## Considered options

- **JSONB column on parent row** — rejected: forces map-reduce on every read, complicates RLS, and JSONB grows unbounded on the hot row (cache-line bloat).
- **Generic `audit_log` table with `(table_name, row_id, payload)`** — rejected: loses typed columns, complicates indexing, and conflates unrelated audit domains.

## Consequences

- Two new migrations and two new RLS policy quartets per audit domain.
- Read code paths must `JOIN` against sister tables for "show history" UI surfaces.

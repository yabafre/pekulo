---
concept: web-ssr-prefetch
rejected_at: 2026-11-27
decided_by: Fred (aped-triage — 9-agent audit)
---

# Triage: Web SSR prefetching / HydrationBoundary for dashboard reads

- **Date**: 2026-11-27
- **Classification**: FEATURE
- **Reporter**: Frontend Developer agent (9-agent audit)
- **Evidence**: All `(cap)/dashboard/*/page.tsx` routes delegate reads to client-side React Query hooks calling Server Actions without `prefetchQuery`/`HydrationBoundary` (verified in `apps/web/src/app/(cap)/dashboard/page.tsx` and `parametres/page.tsx:305-310`).
- **Reason deferred**: Deliberate architecture choice to preserve React Query cache + encrypted IndexedDB offline persistence coherence (ADR-0010, ADR-0018); not blocking pre-sale unless Lighthouse/TTFMP budgets regress.
- **Reconsider when**: Lighthouse Performance drops below 90 (NFR-3) or TTFMP exceeds 2.5 s on 4G (NFR-4) in production measurement.

## Why this is out of scope

The current client-query model keeps mutations, tag invalidation (`@zapaction/query`), and the encrypted offline cache (ADR-0018) on a single read path. Migrating pages to SSR prefetching adds hydration complexity without proven user-facing benefit prior to public launch.

## Prior requests

- 2026-11-27 -- 9-agent audit (Frontend Developer) -- flagged client-side Server Action cascades on web routes; deferred pending prod Lighthouse/TTFMP metrics.

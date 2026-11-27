---
concept: mobile-offline-mode
rejected_at: 2026-11-27
decided_by: Fred (aped-triage — 9-agent audit)
---

# Triage: Offline read-only cache on mobile app

- **Date**: 2026-11-27
- **Classification**: FEATURE
- **Reporter**: Mobile App Builder agent (9-agent audit)
- **Evidence**: `apps/mobile/package.json` and `apps/mobile/lib/hooks/use-mobile-queries.ts` have no persistent query cache or network-state offline layer (unlike web PWA Epic 9 / ADR-0018).
- **Reason deferred**: Mobile store launch is frozen until after the first 50 web paying clients (`docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`), and offline mode is not a store-submission blocker.
- **Reconsider when**: Post-Epic 14 (after App Store / Google Play V1.5 launch).

## Why this is out of scope

FR-54 targets the web PWA offline cache (shipped in Epic 9). Adding encrypted local persistence + logout purge on iOS/Android is valuable for V1.6 but out of scope for pre-sale web launch and initial store submission.

## Prior requests

- 2026-11-27 -- 9-agent audit (Mobile App Builder) -- flagged absence of mobile offline mode; deferred to post-store-launch V1.6.

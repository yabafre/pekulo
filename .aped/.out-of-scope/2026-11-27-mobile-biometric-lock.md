---
concept: mobile-biometric-lock
rejected_at: 2026-11-27
decided_by: Fred (aped-triage — 9-agent audit)
---

# Triage: Biometric / PIN app lock on mobile

- **Date**: 2026-11-27
- **Classification**: FEATURE
- **Reporter**: Mobile App Builder agent (9-agent audit)
- **Evidence**: No `expo-local-authentication` dependency or app-switcher privacy blur in `apps/mobile/package.json` or `apps/mobile/app/`.
- **Reason deferred**: Already explicitly deferred past the first 50 web clients in `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md:111` and `docs/spikes/2026-11-26-securite-chiffrement-rust.md:121`.
- **Reconsider when**: After reaching 50 paying clients / mobile V1.6 hardening (alongside app-switcher blur).

## Why this is out of scope

Not required by V1/V1.5 PRD or store review guidelines. Mobile tokens are already stored in Keychain (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Biometric lock + screen blur are scheduled as P2 mobile hardening.

## Prior requests

- 2026-11-27 -- 9-agent audit (Mobile App Builder) -- flagged lack of biometric lock; confirmed deferred to post-50 clients / V1.6.

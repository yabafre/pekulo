# Pekulo — RGPD / GDPR readiness (V1 with _proches_)

> **Trigger.** V1 will include the author **and close family/friends** ("proches"). Per the PRD (line 164), _GDPR applies from the first user other than the author_ — so it is triggered **in V1 (a)**, not at the (b) public ramp as the PRD originally assumed. The "purely personal/household" exemption (art. 2-2-c) is narrow and unlikely to cover an app routing proches' **bank data** through commercial processors (Bridge, Supabase). Treat proches-V1 as GDPR-active.
>
> Roles: **Pekulo (Alex) = data controller**. Supabase / Bridge / (future LLM) = **processors**.
> _Not legal advice — confirm against CNIL guidance; engage a DPO if in doubt._

## Data map (foundation of the register)

| Category                                       | Fields                                                                                                                   | Where             | Processor                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------- |
| Identity / auth                                | email, password hash                                                                                                     | Supabase Auth     | Supabase                     |
| Financial                                      | account balances, transactions (amount/label/date), holdings, lots, real-estate, monthly aggregates, compass goals, KPIs | Postgres          | Supabase                     |
| Bank connectivity _(if a proche links a bank)_ | connection metadata, IBAN, bank transactions                                                                             | Bridge → Postgres | **Bridge (AISP)** + Supabase |
| Categorisation _(future, Epic 6 — not built)_  | transaction labels sent to an LLM                                                                                        | —                 | LLM provider (opt-in)        |
| Technical                                      | userId, session cookie, OTel traces (metadata only — verified PII-clean)                                                 | cookies / SigNoz  | —                            |

## 1. Data-subject rights — CODE

- [ ] **Access / portability** → export all user data as JSON — **#48 / story 11-1** (`in-progress`, story file `docs/stories/11-1-data-export.md`). DR-5, ≤ 60 s.
- [x] **Erasure** → delete account, cascade across **every** user-scoped table + erase the Supabase Auth user — **#49 / story 11-2**. Covers all **21** user-scoped tables via an explicit `DELETION_NODES` fan-out in one transaction (not the FK cascade alone: `compass_history`, `milestones`, `user_pref` and `dashboard_layout` had no FK to `auth.users` at all until migration `20260915120000`). Bridge erasure runs FIRST and is fail-closed: every item is revoked and the Bridge user is deleted (`DELETE /v3/aggregation/users/{uuid}`) before a single local row is touched; if Bridge is unreachable, nothing is deleted and the user retries. Vault secret references are purged before `bank_connections` goes. `EXPORT_NODES` and `DELETION_NODES` are asserted equal by a build-failing test, so a future table cannot enter one without the other.
- [x] **Rectification** → users edit their own data (CRUD exists for accounts/transactions/holdings/real-estate).
- [ ] ⚠️ Dependency note: #48/#49 list `8-1-supabase-auth-flows` as a dep (`pending`), but auth is in fact built (server actions shipped in 11-7) — lift this plan-vs-reality gap, don't let it block.

## 2. Lawful basis & transparency — LEGAL / OPS (Alex)

- [ ] **Lawful basis** documented: contract (the service itself) + **consent** for bank connection (Bridge) and for any future LLM categorisation.
- [ ] **Privacy notice** (politique de confidentialité, FR) reachable **before** signup: what data, why, processors, retention, rights, contact. CNIL-aligned.
- [ ] **Consent capture** where required: Bridge bank-link, LLM opt-in (already planned — story 6-3 + AI-transparency 11-5).
- [ ] **Cookie/localStorage map** (CNIL): session cookie = essential (no consent); theme localStorage = essential; analytics = none. Document it.

## 3. Processor agreements — LEGAL / OPS (Alex)

- [ ] **DPA with Supabase** (art. 28) — hosts all personal + financial data. Supabase provides a standard DPA.
- [ ] **Bridge contract + tied-agent clause** (ADR-0015) — Bridge processes proches' bank data. The **production contract** is required before a proche links a real bank (sandbox ≠ prod). The B2B contract must carry the agent-of clause (DR-9).
- [ ] **DPA with the LLM provider** — only if third-party categorisation is enabled. Prefer zero-retention; or keep LLM off / on-device for proches-V1.
- [ ] Price providers (Yahoo / Twelve Data / self-hosted) receive **tickers, not personal data** → likely out of scope; confirm.
- [ ] Maintain a **sub-processor list**.

## 4. Records & retention — LEGAL / OPS

- [ ] **Processing register** (art. 30): auth, finance aggregation, bank aggregation, (future) categorisation.
- [ ] **Retention policy**: how long transactions/aggregates are kept; full deletion on erasure (covered by #49). Document.
- [ ] **Data minimisation**: what Bridge/LLM actually receive. NFR-12 already mandates _zero PII to the LLM, ≤ 2 kb_ — verify. Check IBAN/label exposure.

## 5. Security of processing (art. 32) — mostly DONE

- [x] Tenant isolation (per-user `where:{userId}` + lint rule + static RLS gate) — **11-3**
- [x] Auth: httpOnly session cookies + **enforced nonce CSP** — **11-7**
- [x] Web perimeter: open-redirect guard, security headers, `/openapi` dev-gate — **#102**
- [x] Encryption at rest (Supabase tier) + posture documented — `docs/security.md`
- [x] TLS in transit (Vercel / Caddy)
- [x] Telemetry PII-clean (OTel spans = metadata only — verified)
- [ ] **MFA** (Supabase TOTP) — **recommended** for proches' financial data; not yet enabled.
- [ ] **Breach detection** — GlitchTip wiring (#53) aids detection.
- [ ] Dependency CVE scanning (Dependabot / `bun audit`) — hygiene, not set up.

## 6. Breach notification — LEGAL / OPS

- [ ] **72 h** notification process to CNIL + affected proches: who triggers, template, contact path.

---

## Priority order to onboard the first _proche_

1. **#49 erasure + #48 export** — data-subject rights (legal must) · CODE
2. **Privacy notice + lawful basis + DPAs** (Supabase, Bridge) · LEGAL
3. **Processing register + retention policy** · LEGAL
4. **MFA** · CODE (recommended)

Already safe technically (isolation 11-3, auth 11-7) → **proches will never see each other's data.** The gap is the rights surface (#48/#49) + the controller paperwork above.

Defer to (b) public ramp: global oRPC rate-limit, dependency scanning, full public-scale hardening.

# Triage Decision

- **Issue**: Audit produit multi-agents (9 agents `agency-agents`, moyenne 5,8/10) — 22 constats vérifiés dans le code (dont 3 aggravations/bugs bonus)
- **Date**: 2026-11-27
- **Classification**: MIXED — 10 BUG, 10 FEATURE, 2 QUESTION (dont 1 déjà arbitré par ADR-0013)
- **Priority**: HIGH (Lot A bugs sécurité/RGPD/FX/webhook) → MEDIUM/HIGH (Lot B Epic 13 pré-vente) → DEFER-EPIC-14 (Lot C stores après 50 clients web) → DEFER (Lot D `.aped/.out-of-scope/`)
- **Route**:
  - **Lot A (Hardening bugs, priorité 1 avant pré-vente)** → stories en tête d'Epic 13 (`aped-arch` si ADR requis → `aped-epics` → `aped-story`)
  - **Lot B (Pré-vente Web & Produit)** → **Epic 13** (consolide `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md` + `docs/spikes/2026-11-26-securite-chiffrement-rust.md` + projection euros constants/scénarios B2)
  - **Lot C (Store Readiness Mobile)** → **Epic 14** (gelé jusqu'après 50 clients web ; requiert ADR IAP via `aped-arch`)
  - **Lot D (Out-of-scope)** → 5 entrées créées dans `.aped/.out-of-scope/2026-11-27-*.md`
  - **Questions docs (B1, CSP)** → résolues inline et alignées dans `docs/gtm/`, `docs/security.md` et `docs/spikes/`
- **Scope check**:
  - `docs/state.yaml` : `pipeline.current_phase: sprint`, `sprint.active_epic: 10`, **Epics 0 → 12 (62/62 stories) tous `done`**.
  - Les bugs du Lot A sont des violations de specs déjà livrées (NFR-13, NFR-19, NFR-25, ADR-0016, `docs/architecture.md` L92/L165/L168).
  - Les évolutions Lot B/C étendent le périmètre au-delà des Epics 0–12 et doivent être formalisées en Epic 13 / Epic 14 via `aped-arch` + `aped-epics` avant toute création de story ou écriture de code.
- **Evidence & validated decisions (Fred, 2026-11-27)**:
  - **Décision A8 (IBAN)** : hash HMAC (blind index) rapide sur `accounts.provider_account_key` dès le **Lot A**, puis chiffrement complet par utilisateur + effacement cryptographique en **13-15**.
  - **Décision B2 (Projection)** : inclure **euros constants (inflation) + fourchette pessimiste / réaliste / optimiste** dans **Epic 13** avant la pré-vente.
  - **Décision B1 (Offre fondateur)** : alignée sur `plan-50-clients-janvier-2027.md` (**100 places · 49 €/an garanti tant que l'abonnement reste actif — pas d'offre « à vie »**). Coût unitaire Bridge reste un prérequis ops bloquant à chiffrer avant ouverture.
  - **Constat bonus CSP** : `apps/web/src/lib/security/headers.ts:22` sert déjà `Content-Security-Policy` en mode **enforced** (pas Report-Only) — `docs/security.md`, `plan-50-clients-janvier-2027.md` et `docs/spikes/2026-11-26-securite-chiffrement-rust.md` alignés.

## Validated Triage Matrix (2026-11-27)

### Lot A — Bugs Sécurité, RGPD, Fiabilité & Exactitude (Priorité 1 — avant pré-vente)

| ID  | Constat vérifié                                                       | Preuve code / spec                                                                                                                                                                                                          | Classif. | Route                                                                  |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| A1  | `userId` brut dans les logs oRPC                                      | `apps/api/src/platform/http/request-log.ts:28`, `orpc-mount.ts:74` vs NFR-25 (`docs/prd.md:365`); utiliser `hash-user-id.ts`                                                                                                | BUG      | Story Lot A (Hardening)                                                |
| A2  | Clé advisory hardcodée + réutilisation de `SUPABASE_SERVICE_ROLE_KEY` | `advisory.module.ts:50-52` (fallback littéral) + `runtime-dependencies.ts:318` (clé admin Supabase réutilisée en AES)                                                                                                       | BUG      | Story Lot A (exiger `ADVISORY_ENCRYPTION_KEY`)                         |
| A3  | OpenRouter compté comme UE + bypass `eu-*`                            | `advisory-posture.ts:30` (`openrouter.ai` US + `hostname.startsWith("eu-")`) vs ADR-0016 §3                                                                                                                                 | BUG      | Story Lot A                                                            |
| A4  | Advisory LLM sans vérification d'opt-in utilisateur                   | `advisory-llm.service.ts:57` sans `opt-in-guard` (allowlist active dans `advisory.routes.ts:30-46`, mais consentement requis NFR-13)                                                                                        | BUG      | Story Lot A                                                            |
| A5  | CORS et rate-limit global absents de `apps/api`                       | Absents de `apps/api/src/app.ts` et `Caddyfile.snippet` vs `docs/architecture.md:165-168`                                                                                                                                   | BUG      | Story Lot A                                                            |
| A6  | Webhook Bridge acquitté `204` avant persistance en base               | `bridge-webhook-router.ts:75-82` (`void handleWebhookEvent` en mémoire avant 204)                                                                                                                                           | BUG      | Story Lot A (inbox/outbox DB avant 204)                                |
| A7  | FX 1:1 silencieux + Portefeuille Web & Mobile sans conversion FX      | `portfolio-fx.ts:30-31` (devise absente → 1:1 avec `fxSource: "live"`); 0 badge UI web/mobile (NFR-19 / `architecture.md:92`); `portfolio-section.tsx:58` & `use-mobile-queries.ts:715` n'appellent pas `computeSnapshotFx` | BUG      | Story Lot A                                                            |
| A8  | IBAN stocké en clair dans `accounts.provider_account_key`             | `bridge-client.ts:148` (`iban:${iban}`), `accounts.prisma:13`, `settings.export.ts:70`                                                                                                                                      | BUG      | Story Lot A (blind index HMAC) + Epic 13 (`13-15` envelope encryption) |

### Lot B — Pré-vente Web & Produit (Epic 13)

| ID  | Constat vérifié                                         | Preuve                                                                           | Classif. | Route                                                                     |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| B1  | Contradiction GTM offre fondateur + coût Bridge inconnu | `analyse-gtm-business-plan.md:133` vs `plan-50-clients-janvier-2027.md:148-153`  | QUESTION | Docs alignés (2026-11-27) ; tarif Bridge = action ops fondateur           |
| B2  | Projection nominale sans inflation/frais ni scénarios   | `projection-curve.ts:57-89` (conforme FR-57..59 mais insuffisant pré-vente FIRE) | FEATURE  | Epic 13 (euros constants + fourchette pessimiste/réaliste/optimiste)      |
| B3  | Aucun encaissement Stripe                               | 0 intégration billing                                                            | FEATURE  | Epic 13 (`13-2` Stripe + `13-9` Paywall)                                  |
| B4  | Absence de MFA TOTP                                     | `auth-actions.ts`, `architecture.md:137`, `rgpd-readiness.md:54`                 | FEATURE  | Epic 13 (`13-10` 2FA + alertes)                                           |
| B5  | Pas de révocation de JWT côté API après logout          | `jwt-verifier.ts:55-86` (stateless jusqu'à `exp`) vs FR-47                       | BUG      | TTL JWT court (ops Supabase) + `revoked_before` dans Epic 13 (`13-18`)    |
| B6  | Isolation mono-couche `where: { userId }`               | Acté ADR-0013 (`docs/security.md:7-9`)                                           | QUESTION | Tests IDOR automatisés Epic 13 (`13-16`) ; RLS/requête → `.out-of-scope/` |

### Lot C — Store Readiness Mobile (Epic 14 — après 50 clients web)

| ID  | Constat vérifié                                     | Preuve                                                                                             | Classif. | Route                            |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- | -------------------------------- |
| C1  | Pas de stratégie IAP pour les stores                | `REVIEW-NOTES.md:49`, `.app-review-readiness.json:12`                                              | FEATURE  | ADR (`aped-arch`) + Epic 14      |
| C2  | Pas d'inscription ni mode démo dans le mobile       | `apps/mobile/app/login.tsx` (sign-in seul ; preview masqué si `requireAuth`)                       | FEATURE  | Epic 14                          |
| C3  | Pas de crash reporting mobile (Sentry → GlitchTip)  | Absent de `apps/mobile/package.json` (gap NFR-27)                                                  | BUG      | Epic 14                          |
| C4  | Pas de pipeline release EAS ni OTA (`expo-updates`) | `eas.json` (`submit.production: {}`), `deploy.yml`, `apps/mobile/package.json`                     | FEATURE  | Epic 14                          |
| C5  | Liste transactions mobile non virtualisée           | `transactions/index.tsx:323-334` dans `<ScrollView>` (`screen-shell.tsx:48`, jusqu'à 1 000 lignes) | BUG      | Epic 14 (`FlatList`/`FlashList`) |
| C6  | Pas de fiche store FR + icône générique « P »       | `apps/mobile/assets/icon.png` + `.app-review-readiness.json` (`screenshots_match_build: todo`)     | FEATURE  | Epic 14                          |

### Lot D — Différé (`.aped/.out-of-scope/`)

- `2026-11-27-web-ssr-prefetch.md` (D1) — rouvrir si Lighthouse < 90 ou TTFMP > 2,5 s.
- `2026-11-27-durable-job-queue.md` (D2) — rouvrir avant multi-replica ou > 100 users synchronisés.
- `2026-11-27-mobile-offline-mode.md` (D3) — rouvrir post-Epic 14 (V1.6).
- `2026-11-27-mobile-biometric-lock.md` (D4) — rouvrir post-50 clients / V1.6.
- `2026-11-27-rls-per-request-api.md` (B6 suite) — rouvrir post-50 clients ou si 13-16 révèle un écart.

---

## Prior Triage Decision (2026-05-25 — Resolved)

- **Issue**: Choix d'agrégateur bancaire (AISP) pour récupérer les transactions — Pekulo
- **Classification**: FEATURE
- **Priority**: HIGH (in-scope V1)
- **Route**: Epic 5 — stories `5-6-bridge-connector` (#93) + `5-7-bridge-ui` (#94) — **DONE** (`docs/adr/0015-bank-aggregator-bridge-with-provider-abstraction.md`, `.aped/.out-of-scope/bank-aggregator-resolved-2026-05-25.md`).

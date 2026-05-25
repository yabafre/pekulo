---
concept: bank-aggregator
rejected_at: 2026-05-25
resolved_at: 2026-05-25
resolution: "Promoted to V1 (Epic 5) via aped-course and ADR-0015. Bank-aggregator no longer out-of-scope — Bridge as agent-of AISP introduces FR-60..FR-63 + stories 5-6 / 5-7 (issues #93 / #94). See docs/triage-decision.md (rewritten 2026-05-25) and docs/state-corrections.yaml (2026-05-25 entries)."
decided_by: fred
---

> **RESOLVED 2026-05-25** — same-day reclassification. The original DEFER triage was correct on the PRD-as-written (Vision V2+ + DR-9 ungated), but Fred re-evaluated based on the actual Persona #1 stack (TR = broker only, SG + Revolut = daily) and chose to promote bank connectivity to V1. The body below is preserved as the research record that informed ADR-0015. See ADR-0015 for the decision, the PRD diff (Out of Scope ligne 101 + Vision V2+ ligne 86 + DR-9) for the scope change, and `docs/state-corrections.yaml` (2026-05-25 supersedes entry) for the audit trail.

## Why this is out of scope (HISTORICAL — superseded)

V1 (epics 0–11) is **manual + CSV** for transactions. Epic 5 owns Group E
(FR-28 transactions record, FR-29 CSV import, FR-30 transfer rule) and Epic 6
owns the LLM categorisation; **no FR / NFR / DR currently covers an external
banking API connection** (AISP / PSD2 aggregation). Pulling this in mid-sprint
would open a brand-new scope front (regulatory, security, UX consent, SCA
90-day refresh, provider contract negotiation) while story 5-1 just landed
and 5-2 → 5-5 + epic 6 are still pending. Re-litigating it during the current
sprint is a scope-drift risk.

The work is **deferred**, not refused — it is the natural successor to
epic 5 once V1 manual flows are complete. To pickup, the proper APED entry
is `aped-analyze` (new feature on a brownfield system), then `aped-prd`
(consent UX, refresh policy, error handling), then `aped-arch` (defines the
`BankProvider` abstraction so we are not locked into a single vendor), then
`aped-epics` (likely a new "Epic 12 — Bank connectivity").

## Pre-decided choice (captured 2026-05-25, pivot acté après challenge Fred)

Stack retenu pour le pickup futur (Epic 12 — Bank connectivity probable) :

- **Bridge** (Bankin', groupe BPCE) — agrégateur principal pour les comptes
  du quotidien. Couvre SG (catalogue major-banks FR, "99 % des banques FR")
  et Revolut (figure parmi les 24 agrégateurs intégrant Revolut). Avantages
  décisifs vs Powens : sandbox dev self-serve (pas de friction commerciale),
  DX best-in-class, commercial early-stage friendly via Bridge for Startups,
  catégorisation FR héritée de 10+ ans Bankin' grand public. AISP + PISP
  agréé ACPR.
- **Story 5-2 `csv-import`** (déjà planifiée, prochaine `pending` de
  l'epic 5) — absorbe naturellement le besoin Trade Republic via export CSV
  ponctuel. TR sert uniquement de poche broker / PEA / CTO chez Fred, pas
  de compte courant → pas besoin d'agrégateur pour TR en V1.
- **Epic 3 holdings (manuel)** — couvre déjà les positions PEA / CTO / crypto
  TR en flow manuel (3-1 done). Synergie : pas de double effort.

Providers écartés :

- **Powens** (ex-Budget Insight) — éligible techniquement (connecteur TR
  maintenu, module Wealth) mais friction trop forte pour un V1 perso à
  10 users : pas de sandbox self-serve, contrat 12–24 mois, setup fee
  1–5 k€. Bugs récurrents synchro TR signalés sur forum Finary confirment
  que même le "stable" n'est pas si stable. **À reconsidérer pour V2 / ramp
  public** quand le P&L absorbera le setup et que le scope patrimonial
  (module Wealth) deviendra critique.
- **GoCardless Bank Account Data** (ex-Nordigen) — fermeture des nouvelles
  inscriptions depuis juillet 2025.
- **Bridge × TR direct** — connecteur TR défaillant côté Bridge (SCA
  quotidienne exigée par TR, comptes courants non récupérés, PEA mal
  synchronisés). Pas bloquant ici car TR n'est pas une source courante
  pour Pekulo — la story 5-2 csv-import couvre le besoin.
- **Salt Edge / Tink** écartés (couverture FR moindre / overkill petit volume).

## Validation debt to honour when we revisit

1. Tester la couverture réelle Bridge × SG (catégorisation auto, fraîcheur
   transactions) et Bridge × Revolut (Revolut est un cas réputé délicat,
   confirmer que `/transactions` retourne tout y compris vaults / pockets).
2. Obtenir la grille tarifaire Bridge via formulaire dev (mentionner
   "petit volume, V1 perso, validation produit").
3. Définir l'abstraction `BankProvider` (Bridge d'abord, mais code iso pour
   switch éventuel vers Powens en V2) lors de l'`aped-arch` de l'epic
   dédié — pas avant.
4. Vérifier que le contrat Bridge n'impose pas un volume minimum mensuel
   qui rendrait le 10-users V1 non viable.

## Prior requests

- 2026-05-25 (pivot) -- même conversation Fred -- challenge "Powens forcément commercial, pas si stable" + précision "TR = broker uniquement, SG + Revolut pour le quotidien" → pivot vers Bridge + CSV pour TR ; Powens repoussé en V2/ramp public.
- 2026-05-25 -- conversation Fred (5-1 polish window) -- demande "comment se connecter aux banques pour récupérer les transactions ?" → première itération de la recherche, choix initial Powens (avant challenge).

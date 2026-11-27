# Product Marketing Context

**Document version:** v3
**Last updated:** 2026-11-26

> Brouillon auto-rédigé à partir du repo (`docs/prd.md`, `docs/grill-summary.md`, ADR-0015, textes de l'app) et de `docs/gtm/2026-11-26-analyse-gtm-business-plan.md`. Les éléments marqués **[À VALIDER]** sont des hypothèses, pas des faits. **[MANQUANT]** = aucune donnée dans le repo.

## Product Overview

**One-liner:** Fixe ton cap. Chaque mois, Pekulo te dit si tu es dans les temps — avec tes vrais comptes, et sans jamais te vendre un placement.

**Short version:** Sache en 5 secondes si tu atteindras ton cap.

**What it does:** Pekulo regroupe tout le patrimoine d'une personne (comptes bancaires synchronisés, bourse, crypto, immobilier avec crédit et locatif) et mesure en continu l'écart entre la trajectoire réelle et un cap unique (capital cible + horizon), découpé en paliers intermédiaires. Chaque écran répond d'abord à « suis-je dans les temps ? ».

**Product category:** Copilote d'indépendance financière : suivi de patrimoine piloté par un objectif (rayon où l'on cherche : « suivi FIRE », « simulateur indépendance financière », « alternative Finary », « appli patrimoine »).

**Product type:** App B2C — PWA installable (web) + app mobile Expo iOS/Android (V1.5).

**Business model:** Freemium, vente directe web (Stripe), sans stores pour le lancement.
- Gratuit : 1 cap, 2 paliers, saisie manuelle + CSV, verdict.
- Plus : 7,99 €/mois ou 69 €/an — synchro bancaire Bridge, paliers illimités, immobilier, bilan mensuel, clôture mensuelle.
- **Membre fondateur 2027 : 49 €/an**, prix garanti tant que l'abonnement est actif, 100 places, jusqu'au 31/01/2027, satisfait ou remboursé 30 jours. Pas d'offre « à vie » (Bridge coûte chaque mois).

## Target Audience

**Target companies:** N/A (B2C). Particuliers en France, base EUR.

**Decision-makers:** L'utilisateur lui-même.

**Primary use case:** Savoir si son patrimoine progresse assez vite pour atteindre un objectif chiffré et daté, sans maintenir de tableur.

**Jobs to be done:**
- « Dis-moi si je suis en avance ou en retard sur mon objectif, sans que j'aie à calculer. »
- « Remplace mon tableur de projection que je n'arrive pas à tenir à jour. »
- « Montre-moi quel palier vient ensuite et ce qu'il me manque pour l'atteindre. »

**Use cases:**
- Point quotidien en 5 s : patrimoine total, % d'avancement du cap, prochain palier et écart.
- Clôture mensuelle : revenus / dépenses / épargne, validation des catégories proposées, mois figé.
- Ajout d'un bien immobilier : sa valeur nette (moins le crédit) compte dans le cap.

**ICP [À VALIDER] :** 25–40 ans, cadre / tech / freelance, investit déjà (PEA ETF, Trade Republic, un peu de crypto, parfois un locatif), sensible au FIRE, a ou a eu un tableur de projection. Niveau de conscience : *problem aware*, peu *solution aware*. Persona #1 = le fondateur (Alex).

## Personas

N/A — B2C, un seul décideur.

## Problems & Pain Points

**Core problem:** On connaît son patrimoine (ou à peu près), mais pas sa trajectoire : impossible de dire si l'on atteindra son objectif à temps.

**Why alternatives fall short:**
- Tableur : manuel, jamais à jour, aucune synchro bancaire.
- Agrégateurs (Finary, Bankin') : montrent tout, mais l'objectif est un widget décoratif ; l'expérience est organisée autour du solde ou du budget, pas d'un cap.
- Courtiers (Trade Republic) : excellents pour acheter / vendre, mais ne couvrent qu'une partie du patrimoine.
- Simulateurs FIRE / ProjectionLab : planifient sur des hypothèses, sans les données réelles du mois.

**What it costs them:** Du temps (tableur), et surtout de l'incertitude : on épargne sans savoir si c'est assez, ou on découvre trop tard qu'on a dérivé.

**Emotional tension:** Doute (« est-ce que je fais assez ? »), culpabilité de ne pas suivre, peur de se tromper de trajectoire. **[MANQUANT : verbatims clients]**

## Competitive Landscape

**Direct:** Finary (Lite ~55, Plus ~150, Pro ~350 €/an) — agrégation large + simulateur Monte Carlo « Predict » qui donne un âge, pas un écart mensuel au plan. Plaintes récurrentes : synchro (Trade Republic, néobanques), hausses de prix silencieuses, locatif limité. Vend ses propres produits (Finary Life, frais crypto 0,99–1,49 %) → neutralité discutable.
**Direct:** Bankin' (Plus ~40 €/an, Pro ~100 €/an) — budget et agrégation d'abord, aucun pilotage par objectif.
**Secondary:** Simulateurs FIRE gratuits (S'investir, Invesse, France FIRE, Simulateur FIRE, MyFinanceTools) — calculent le cap mais restent hypothétiques : aucune donnée réelle, aucun suivi mensuel.
**Secondary:** ProjectionLab / Boldin (US) — planification FIRE puissante, pas de synchro bancaire française.
**Indirect:** Tableurs (Avenue des Investisseurs, Sinvestir, maison) ; open source (Wealthfolio) ; CGP ; ne rien suivre du tout.

## Differentiation

**Key differentiators (les trois seuls à marteler) :**
1. **Verdict mensuel réel** — « Tu atteins ton cap en 2041 » / « Il manque 230 € / mois », calculé sur tes vrais comptes, palier par palier. (Simulateurs : hypothétiques ; Finary : un âge Monte Carlo.)
2. **Neutre par construction** — aucun placement vendu, aucune commission ; IA sur l'appareil ou auto-hébergée, API tierce uniquement sur opt-in ; export et suppression RGPD en libre-service.
3. **Tout ton patrimoine compte** — banque, bourse avec lots, crypto, immobilier net du crédit avec cash-flow locatif, Trade Republic par import CSV.

**How we do it differently:** « Fixe ton cap, tout s'aligne » — chaque écran hérite du cadrage du cap.

**Why that's better:** Une seule question, une réponse en 5 secondes, mise à jour automatique, sans conflit d'intérêt.

**White space :** les simulateurs ont le cap sans les données ; Finary a les données sans le cap, et vend des placements. Pekulo relie les deux, de façon neutre.

**Why customers choose us:** **[MANQUANT — pas encore d'utilisateurs externes]**

## Objections

| Objection | Response |
|-----------|----------|
| « Je ne veux pas donner l'accès à ma banque à une petite app. » | Essaie d'abord en mode démo, sans rien connecter. Ensuite : connexion via Bridge (établissement agréé ACPR), lecture seule, révocable en un clic ; 2FA ; export et suppression du compte en libre-service. La saisie manuelle et le CSV restent possibles. **[À VALIDER : formulation juridique]** |
| « Et si Pekulo ferme ? » | Engagement de réversibilité : préavis de 90 jours, export complet, remboursement au prorata, code source publié. |
| « Je ne pourrai pas résilier facilement. » | Résiliation en 3 clics depuis les paramètres, satisfait ou remboursé 30 jours pour les fondateurs. |
| « Finary fait déjà tout ça. » | Finary montre tout et vend des placements ; Pekulo répond à une seule question — suis-je dans les temps pour mon cap ? — et ne vend rien d'autre que l'outil. |
| « Les simulateurs FIRE sont gratuits. » | Ils calculent ton cap une fois, sur des hypothèses. Pekulo vérifie chaque mois, avec tes vrais comptes, si tu tiens la trajectoire. |
| « Mon tableur me suffit. » | Ton tableur ne se met pas à jour tout seul et ne te dit pas si tu dérives ce mois-ci. |
| « Ça va me dire quoi acheter ? » | Non. Pekulo suit et projette, il ne conseille jamais d'investissement. |

**Anti-persona:** Débutant sans épargne (son besoin est le budget) ; trader actif ; patrimoine > 2 M€ qui veut un CGP humain ; quelqu'un qui cherche des recommandations d'achat.

## Switching Dynamics

**Push:** Tableur abandonné ; agrégateur « qui montre tout mais ne dit rien » ; hausse de prix et synchros cassées chez Finary ; méfiance envers un outil qui vend aussi des placements.
**Pull:** Réponse en 5 s ; paliers ; immobilier et crédit pris en compte ; confidentialité.
**Habit:** Tableur bricolé et familier ; app déjà installée (Finary, Bankin').
**Anxiety:** Sécurité des données bancaires ; pérennité d'une petite app (« et si elle ferme ? ») ; effort de re-saisie.

## Customer Language

**How they describe the problem:**
- **[MANQUANT — à collecter lors de 15–20 entretiens (skill `customer-research`) et dans r/vosfinances]**

**How they describe us:**
- **[MANQUANT]**

**Words to use:** cap, palier, dans les temps, en avance / en retard, trajectoire, patrimoine, clôture du mois, bilan du mois, horizon, neutre, « il manque X € / mois ».

**Words to avoid:** rendement garanti, devenir riche, conseil, recommandation, « investis dans… », IA (comme promesse principale), « boussole » (terme du PRD, pas de l'app).

**Glossary:**
| Term | Meaning |
|------|---------|
| Cap | Objectif principal : capital cible (€) + année d'horizon (« compass » dans le PRD) |
| Palier | Étape intermédiaire datée vers le cap (« milestone » dans le PRD) |
| Clôture mensuelle | Validation d'un mois (catégories confirmées), qui devient immuable |
| Patrimoine net | Total des actifs (banque, bourse, crypto, immobilier) moins les dettes |

## Brand Voice

| Attribute | Means | Doesn't mean | Example line |
|-----------|-------|--------------|--------------|
| Direct | Tutoiement, phrases courtes, verbe d'action en tête | Familier ou vulgaire | « Pilote ton plan financier : épargne, projection de capital, portefeuille. » |
| Calme | Chiffres et écarts présentés sans dramatiser | Froid ou technique | « Prochain palier » |
| Honnête | On dit ce qu'on fait et ce qu'on ne fait pas | Juridique ou défensif | « Pekulo ne te vendra jamais un placement. » **[À VALIDER]** |
| Guidant | On indique la prochaine étape | Paternaliste | « Définis ton premier palier » |

**Tone by context:**
- Support : tutoiement, factuel, une solution par message.
- Launch : enthousiaste sur la clarté, jamais sur l'argent gagné.
- Errors : dire ce qui s'est passé et quoi faire (« Cap indisponible » → ajouter l'action).
- Sales : ancienne façon (tableur) → nouvelle façon (cap à jour automatiquement).
- Social : une idée par visuel, chiffres pédagogiques, aucune promesse.

**Terms we own:** Cap, palier, « dans les temps ».
**Never use (and why):** « conseil » / « recommandation » (statut CIF/AMF) ; promesses de rendement (pratiques trompeuses, AMF) ; « vous » (incohérent avec le tutoiement de l'app — une occurrence « de votre cap » à corriger).

## Proof Points

**Metrics:** **[MANQUANT]** — à mesurer : temps pour répondre à « suis-je dans les temps ? » (cible PRD < 5 s), précision de la catégorisation (cible ≥ 80 %).
**Customers:** Aucun utilisateur externe (rampe (a)).
**Testimonials:** **[MANQUANT — ne jamais en inventer]**

**Value themes:**
| Theme | Proof |
|-------|-------|
| Clarté en 5 s | Dashboard centré sur le cap (Epic 1, Epic 7) |
| Patrimoine complet | Banque Bridge, bourse avec lots, crypto, immobilier net du crédit (Epics 2–5) |
| Confidentialité | IA sur l'appareil / auto-hébergée, opt-in tiers ; export et suppression RGPD (Epics 6, 11) |
| Partout | PWA hors ligne + apps iOS/Android (Epics 9, 10) |

## Goals

**Business goal:** **50 clients payants (Membre fondateur 2027) au 31 janvier 2027**, pour être en positif. Plan : `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`.
**Conversion action:** Inscription → cap + 1 palier posés → verdict affiché (activation) → offre fondateur.
**Funnel cible [H] :** ~5 000 visiteurs → ~600 inscrits → ~250 caps posés → 50 payants.
**Jalons :** 10 payants au 14/12 · 20 au 21/12 · 30 au 31/12 · 40 au 07/01 · 50 au 31/01.
**Current metrics:** Aucune (pas d'analytics installé).

## Learnings

*Decisions and tested lessons. Newest first. Keep it to about 20 active entries.*

| Date | Learning | Evidence | Applies to | Status |
|------|----------|----------|------------|--------|
| 2026-11-26 | La neutralité (« aucun placement vendu ») est un différenciant face à Finary Life | Recherche concurrentielle (avis 2026) — décision, pas encore testée | Landing, objections, social | watch |
| 2026-11-26 | Pas d'offre « à vie » : la synchro Bridge est un coût mensuel récurrent | ADR-0015, décision de pricing | Pricing, offre fondateur | active |
| 2026-11-26 | Le vocabulaire produit est « cap » / « palier », pas « boussole » / « jalon » | Chaînes de l'UI (`apps/web/src`) | Tout le copywriting | active |
| 2026-11-26 | Ne pas vendre l'IA : la catégorisation est une commodité (Bridge catégorise déjà) | Analyse GTM, test « enlève le mot IA » | Landing, stores, social | active |

## Changelog

*Newest first. One line per revision: what changed and why.*

- v3 (2026-11-26) — Objections : ajout « et si Pekulo ferme ? » (réversibilité) et « résiliation », réponse sécurité enrichie (mode démo, 2FA, révocation).
- v2 (2026-11-26) — Promesse réécrite autour du verdict mensuel + neutralité ; concurrence mise à jour (prix Finary, Predict, Finary Life, simulateurs FIRE, tableurs) ; offre Membre fondateur 2027 ; objectif 50 clients au 31/01/2027.
- v1 (2026-11-26) — Initial context, auto-drafted from PRD, grill summary, ADR-0015, in-app copy and the GTM analysis.

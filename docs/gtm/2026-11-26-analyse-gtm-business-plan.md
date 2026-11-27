# Pekulo — Analyse go-to-market & business plan

**Date :** 2026-11-26 · **Sources :** vidéo « Comment faire 1M€ en ligne avec l'IA » (Louis Key, 4 h 56, 20/09/2026) analysée avec ffmpeg + transcription ; repo `coreyhaines31/marketingskills` (52 skills) ; `docs/prd.md`, `docs/grill-summary.md`, `docs/epics.md`, ADR-0015 ; recherche web (concurrents, marché).

> Statut : **analyse validée pour archivage (2026-11-26)** — hypothèses encore ouvertes. Vocabulaire : ce rapport dit « boussole » / « jalon » (termes du PRD) ; l'app et le copywriting disent **« cap » / « palier »** — voir `.agents/product-marketing.md`. Les hypothèses chiffrées marquées **[H]** sont à confirmer.

---

## 1. Ce que dit la vidéo (et ce que ffmpeg en révèle)

### 1.1 Analyse technique (ffmpeg / ffprobe)

| Mesure                            | Résultat                                        | Lecture                                                                                  |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Durée                             | 17 757 s (4 h 56)                               | Format « bible », pensé pour l'autorité, pas pour la complétion                          |
| Changements de scène (seuil 0,30) | 334 au total, ≈ 1,1/min                         | Montage sobre : slides + webcam en incrustation + captures d'écran de Claude/Google Docs |
| Intro (0–4 min)                   | **5,7 coupes/min**                              | Le hook est 5× plus monté que le reste (preuve Stripe, promesse, « 99 % vont quitter »)  |
| « Premiers 1 000 € »              | 124 min = **42 % de la durée**, 55 % des coupes | Le cœur réel de la vidéo : niche, offre, landing, pricing, prospection, contenu          |
| « 10k → 100k »                    | 22 min seulement                                | La partie « scale » est mince — c'est un teaser de son accompagnement payant             |
| Silences > 1,5 s                  | 32, 118 s cumulées sur 5 h                      | Montage serré (silences coupés)                                                          |
| Loudness intégrée                 | −24,7 LUFS, LRA 9 LU                            | Voix posée, non compressée (YouTube normalise à −14)                                     |

Planche contact (1 image / 10 min) : charte **jaune citron / noir**, une idée par slide (« Choisis ton véhicule », « Une hungry crowd », « Le piège du gratuit », « Retirer · Déléguer · Automatiser », « Théorie des contraintes »). Format reproductible à faible coût pour du contenu Pekulo.

### 1.2 Les frameworks utiles (condensés)

1. **Hungry crowd + « la carte bancaire ne ment jamais »** : partir d'un problème pour lequel les gens _paient déjà_ ; la concurrence prouve la demande.
2. **4 piliers d'un modèle rentable** : scalable · marges élevées (prix 3–10× le coût) · problème urgent · valeur perçue forte.
3. **Test « enlève le mot IA »** : l'offre doit rester désirable sans la techno. On vend le résultat, pas le moyen.
4. **Un seul produit, un seul avatar** avant 1 M€.
5. **Croyances & niveaux de conscience** (unaware → most aware) ; **TOFU / MOFU / BOFU** ; plus le marché est sophistiqué, plus il faut de BOFU.
6. **Pricing** : 3 paliers avec ancrage, marge ≥ 60–70 %, upsell/downsell.
7. **« Héros 100 »** : lister 20–100 cibles idéales, contacter à la main pour du **feedback avant l'argent**.
8. **Contenu** : copier-améliorer les formats viraux de la niche ; structure hook → story → 3 valeurs → CTA ; hook « dream outcome ».
9. **Théorie des contraintes** : le goulot est soit le front-end (acquisition), soit le back-end (livraison) — épuiser volume puis qualité avant d'inventer une nouvelle stratégie.

### 1.3 Ce qui ne s'applique PAS à Pekulo

- Tout le modèle **drop-servicing B2B** (packs à 280–1 780 €, sous-traitance Upwork, appels de closing). Pekulo est un **B2C à faible ARPU** : les maths « 10 ventes × 450 € = 5 k€ » deviennent « ~1 200 abonnés payants ».
- **Preuve sociale fictive** et promesses de résultat : **interdit** en finance perso (AMF, loi influenceurs 2023, pratiques commerciales trompeuses).
- « Poster 5–10 fois/jour » : calibré pour un fondateur-média, pas pour un dev solo.
- Aucune métrique SaaS (activation, rétention, churn, conversion freemium) : il faut les prendre ailleurs (→ marketingskills).

### 1.4 L'avertissement à prendre au sérieux

> « 99 % des SaaS vont disparaître, remplacés par Claude » (opinion, non étayée).

Pour Pekulo : un **calculateur de projection** seul est remplaçable par n'importe quel LLM en 30 s. Ce qui ne l'est pas : **les données réelles synchronisées** (Bridge), l'historique mois par mois, la confiance (RGPD, chiffrement, pas de revente), et la boucle quotidienne « suis-je dans les temps ? ». La catégorisation IA, elle, est une commodité (Bridge catégorise déjà) → **ne pas la mettre en avant comme promesse**.

---

## 2. Pekulo résout-il un vrai problème ?

### 2.1 Le problème

« Je sais combien j'ai, mais **je ne sais pas si je suis dans les temps** pour atteindre mon objectif (ex. 500 k€ en 2045 / indépendance financière). Je le calcule dans un tableur que je ne mets jamais à jour. »

### 2.2 Tests

| Test                                        | Verdict                                | Justification                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carte bancaire (des gens paient-ils déjà ?) | ✅ Oui                                 | Finary Plus ~120–150 €/an, Bankin' Plus ~40 €/an et Pro ~100 €/an, ProjectionLab (US, planificateur FIRE) ~100–130 $/an                                             |
| Hungry crowd identifiable                   | ✅ Oui                                 | ~7,3 M de PEA (Banque de France, fin 2025), ~1,2 M d'investisseurs actifs par trimestre et record de nouveaux investisseurs ETF (AMF, S1 2026)                      |
| Taille × fréquence (skill `marketing-plan`) | ⚠️ **Gros problème, faible fréquence** | On vérifie sa trajectoire 1×/mois, pas 1×/jour → risque de churn ; il faut une boucle fréquente (sync bancaire, alertes de jalon, clôture mensuelle)                |
| « Enlève le mot IA »                        | ✅ Passe                               | « Sache en 5 secondes si tu atteindras 500 k€ en 2045 » tient sans IA                                                                                               |
| Différenciation                             | ⚠️ Fragile                             | Finary couvre déjà « tout voir au même endroit » + objectifs ; le différenciant (boussole + jalons comme axe central) est réel mais doit être **la seule promesse** |
| Moat face à l'IA                            | ⚠️ Moyen                               | Tient par les données réelles + la confiance, pas par l'UI ni l'IA                                                                                                  |

**Verdict :** oui, Pekulo résout un problème réel et monétisable — **mais le périmètre « Finary-class » (budget + bourse + crypto + immo) dilue la promesse**. La vidéo et la skill `product-marketing` convergent : une promesse, un avatar.

---

## 3. Ce qui est fait vs ce qui reste à faire

### 3.1 Produit (fait — solide)

Boussole + jalons (Epic 1), comptes, portefeuille avec lots et 4 sources de prix, crypto, immobilier + crédit + locatif, transactions + import CSV, sync bancaire Bridge (Epic 5), catégorisation LLM routée (Epic 6), dashboard + projection (Epic 7), PWA offline chiffrée (Epic 9), export/suppression RGPD (Epic 11), app mobile iOS/Android en cours (Epic 10).

### 3.2 Go-to-market (rien n'existe encore)

| Élément                           | État constaté dans le repo                                   | Skill marketingskills                                          |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Positionnement / ICP écrit        | ❌ Pas de `.agents/product-marketing.md`                     | `product-marketing` (fondation lue par toutes les autres)      |
| Landing page                      | ❌ `apps/web/src/app/page.tsx` redirige vers `/login`        | `copywriting`, `cro`, `site-architecture`                      |
| Liste d'attente / capture d'email | ❌                                                           | `lead-magnets`, `signup`                                       |
| Analytics produit                 | ❌ Aucune dépendance analytics trouvée                       | `analytics`, `conversion-tracking`                             |
| Pricing / facturation             | ❌ Ni Stripe ni RevenueCat ; pricing « différé » dans le PRD | `pricing`, `paywalls`                                          |
| Recherche client                  | ❌ Persona #1 = le fondateur uniquement                      | `customer-research`                                            |
| Contenu / SEO                     | ❌                                                           | `content-strategy`, `free-tools`, `programmatic-seo`, `ai-seo` |
| Fiche stores                      | ❌ (Epic 10 en cours)                                        | `aso`                                                          |
| Lancement                         | ❌                                                           | `launch`, `directory-submissions`                              |
| Parrainage / rétention            | ❌                                                           | `referrals`, `churn-prevention`, `emails`                      |
| Contrat Bridge production         | ⏳ Bloquant (ADR-0015) — coût par utilisateur inconnu        | —                                                              |

---

## 4. Cible & prospects

### 4.1 ICP (avatar unique pour démarrer)

**« L'investisseur méthodique qui a un chiffre en tête »** — 25–40 ans, cadre/tech/freelance, revenu 35–80 k€, investit déjà (PEA ETF, Trade Republic, un peu de crypto, parfois un locatif), s'intéresse au FIRE, a un **tableur de projection** qu'il ne maintient pas. Niveau de conscience : _problem aware_ (il sait qu'il veut un objectif), peu _solution aware_ sur une boussole dédiée.

**Anti-persona :** le débutant sans épargne (besoin = budget, pas boussole), le trader actif, le patrimoine > 2 M€ (veut un CGP humain).

### 4.2 Où les trouver

- Communautés : r/vosfinances, communautés FIRE francophones, Discords finance perso, forum Finary (avec tact).
- YouTube / podcasts finance perso FR (partenariats, sponsoring de niche plus tard).
- Utilisateurs de tableurs FIRE : leur proposer d'**importer leur tableur** = argument de switch.
- Recherche : « calcul indépendance financière », « combien pour vivre de ses rentes », « simulateur FIRE France » → outil gratuit.

### 4.3 Option B2B2C (piste « hungry crowd avec pouvoir d'achat » de la vidéo)

CGP indépendants et coachs en finances perso : une boussole partagée avec leurs clients (cf. ProjectionLab Pro ~549 $/an/conseiller). Panier 10× supérieur, mais **hors périmètre aujourd'hui** (RLS mono-utilisateur, multi-utilisateur exclu du PRD jusqu'à V3). À garder comme pivot si le B2C ne décolle pas.

---

## 5. Offre & pricing

### 5.1 Principes retenus (skill `pricing` + vidéo)

- Prosumer → tranche **~10 €/mois** ; éviter le « piège des 2,99 € » (fausse traction, prix impossible à remonter).
- Se placer **entre l'alternative suivante et la valeur perçue** : sous Finary Plus, au-dessus de Bankin' Plus.
- **Le coût variable (Bridge) va derrière le paywall** : le gratuit ne coûte presque rien, le payant couvre la synchro.
- Montrer le paywall **après le moment « aha »** (boussole posée + premier pourcentage d'avancement), jamais pendant l'onboarding.

### 5.2 Proposition [H]

| Palier                                                                                                                                        | Prix                                                                                                                       | Contenu                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Gratuit**                                                                                                                                   | 0 €                                                                                                                        | 1 boussole, 2 jalons, saisie manuelle + import CSV, projection simple                                                            |
| **Plus** _(recommandé)_                                                                                                                       | **7,99 €/mois ou 69 €/an**                                                                                                 | Synchro bancaire Bridge, jalons illimités, immobilier + crédit, crypto, catégorisation auto, clôture mensuelle, alertes de jalon |
| **Membre fondateur** _(pré-vente, **100 places** — aligné 2026-11-27 sur `plan-50-clients-janvier-2027.md`, remplace « 200 places / à vie »)_ | **49 €/an** _(tarif garanti tant que l'abonnement reste actif — pas d'offre « à vie » en raison du coût récurrent Bridge)_ | Tout Plus — sert de **test « carte bancaire »** avant l'ouverture publique                                                       |

Plus tard : scénarios (optimiste/réaliste/pessimiste, Phase 3 du PRD) comme palier « Pro » ~12,99 €/mois ou en upsell.

---

## 6. Business plan & rentabilité

### 6.1 Coûts [H]

| Poste                                    | Montant                                                       | Source                                             |
| ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Infra (VPS Dokploy + Supabase)           | ~25–50 €/mois                                                 | PRD B3 (< 25 €/mois pour 100 users)                |
| Comptes stores                           | Apple 99 €/an + Google 25 $ une fois                          | —                                                  |
| Domaine, email transactionnel, analytics | ~20 €/mois                                                    | —                                                  |
| **Bridge**                               | **inconnu — hypothèse 0,50–1 €/utilisateur synchronisé/mois** | ADR-0015 : à obtenir auprès des commerciaux Bridge |
| Frais de paiement                        | Stripe ~1,5 % + 0,25 € ; stores 15 % (Small Business Program) | —                                                  |

### 6.2 Économie unitaire (abonné Plus annuel)

- 69 € TTC → ~57,50 € HT (TVA 20 %) → net de frais (mix 50 % web / 50 % stores) ≈ **52 €/an ≈ 4,35 €/mois**
- − Bridge [H] 1 €/mois → **contribution ≈ 3,35 €/mois/abonné** (marge brute ~77 %, au-dessus du seuil de 60–70 % de la vidéo)
- Utilisateur gratuit (sans synchro) : quelques centimes/mois

### 6.3 Seuils

| Objectif mensuel net               | Abonnés payants nécessaires | Utilisateurs gratuits à 2,1 % (médiane freemium RevenueCat) | Essais à 10,7 % (médiane essai → payant avec paywall dur) |
| ---------------------------------- | --------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Couvrir l'infra (~100 €)           | **~30**                     | ~1 400                                                      | ~280                                                      |
| 1 000 € (palier 1 de la vidéo)     | **~300**                    | ~14 300                                                     | ~2 800                                                    |
| 3 000 € (revenu fondateur modeste) | **~900**                    | ~43 000                                                     | ~8 400                                                    |
| 10 000 € (palier 2 de la vidéo)    | **~3 000**                  | ~143 000                                                    | ~28 000                                                   |

**Conclusion :** Pekulo peut être **rentable vite** (coûts fixes minuscules, ~30 payants), mais **faire vivre un fondateur demande ~1 000 payants** — c'est un problème de **distribution**, pas de produit. Théorie des contraintes : le goulot est 100 % front-end.

Leviers par ordre d'impact : (1) **essai gratuit 14 jours de Plus avec paywall dur sur la synchro** plutôt que freemium pur (~5× la conversion médiane), (2) annuel par défaut, (3) parrainage, (4) prix — à remonter dès que conversion > 40 % ou churn < 3 %/mois.

---

## 7. Comment le vendre

### 7.1 Message

- **Promesse :** « Sache en 5 secondes si tu es dans les temps pour ton objectif. »
- **Ancienne façon / nouvelle façon :** le tableur que tu oublies → une boussole qui se met à jour seule avec tes comptes.
- **Croyance finale à installer** (méthode de la vidéo) : « je veux être libre financièrement » → « il me faut un chiffre et une date » → « je dois mesurer mon écart chaque mois » → « un tableur ne tient pas » → « Pekulo le fait automatiquement, sans vendre mes données ».
- **À ne jamais dire :** rendement, « devenir riche », recommandation d'achat, témoignages de gains.

### 7.2 Canaux (budget 0 € → organique d'abord)

| Étape      | Canal                                                                                                         | Mécanisme                                                | Skill                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------- |
| TOFU       | **Outil gratuit « Calculateur de boussole »** sans compte (capital cible, horizon, effort mensuel nécessaire) | SEO + partage ; CTA « suis ta boussole automatiquement » | `free-tools`, `programmatic-seo` |
| TOFU       | Carrousels / shorts format « slide jaune » (1 idée = 1 slide) : « Combien pour être rentier à 45 ans ? »      | Hook « dream outcome » (sans promesse)                   | `social`, `video`                |
| MOFU       | Newsletter « clôture du mois » (méthode, pas conseil)                                                         | Rétention + confiance                                    | `emails`                         |
| BOFU       | Landing + comparatif honnête vs tableur / Finary                                                              | Conversion                                               | `copywriting`, `competitors`     |
| Activation | Onboarding en 3 étapes (boussole → jalon → 1 compte) = J1 du PRD                                              | Moment aha                                               | `onboarding`, `paywalls`         |
| Referral   | 1 mois offert par filleul abonné                                                                              | Boucle                                                   | `referrals`                      |
| Stores     | Fiche App Store / Play optimisée                                                                              | ASO                                                      | `aso`                            |

### 7.3 « Héros 100 » transposé

Recruter **100 bêta-testeurs à la main** (r/vosfinances, Discords FIRE) : objectif = feedback + verbatims clients (pour le doc `product-marketing`), puis leur proposer l'offre Membre fondateur.

---

## 8. Plan à 90 jours (AARRR)

| Semaines             | Actions                                                                                                                                  | Critère de sortie                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **1–2 · Débloquer**  | Signer Bridge et obtenir le **coût par utilisateur** ; rédiger `.agents/product-marketing.md` ; installer l'analytics (EU, consentement) | Coût unitaire connu ; positionnement écrit |
| **3–4 · Fondations** | Landing + liste d'attente (remplace la redirection `/login`) ; calculateur gratuit public ; 15–20 entretiens (`customer-research`)       | 300 inscrits en liste d'attente            |
| **5–8 · Vitesse**    | 3 contenus/semaine (TOFU/BOFU) ; bêta privée Héros 100 ; **pré-vente Membre fondateur 49 €/an** (Stripe)                                 | **≥ 50 pré-ventes**                        |
| **9–12 · Compound**  | Ouverture publique (rampe b) ; essai 14 j + paywall sur la synchro ; parrainage ; lancement stores (`launch`, `aso`)                     | ≥ 150 payants, churn mensuel < 5 %         |

**Critère d'arrêt / pivot :** moins de 20 pré-ventes pour plus de 1 000 visiteurs sur la landing → retravailler la promesse, ou explorer la piste B2B2C CGP.

---

## 9. Garde-fous réglementaires (non négociables)

- Pekulo reste **outil de suivi + planification**, jamais conseil en investissement (statut CIF/AMF) ; l'Epic 12 « advisory » reste interne.
- Pas de promesse de rendement, pas de témoignages de gains, pas d'urgence artificielle.
- Mentions obligatoires si promotion via créateurs (loi influenceurs 2023).
- Relation agent de Bridge à formaliser contractuellement avant tout trafic de production (DR-9 / ADR-0015).
- RGPD : consentement analytics, données hébergées en UE, export/suppression déjà livrés (à mettre en avant comme preuve de confiance).

---

## 10. Ordre d'exécution des skills marketingskills

`product-marketing` → `customer-research` → `competitors` → `pricing` → `free-tools` → `copywriting` + `cro` (landing) → `analytics` → `onboarding` + `paywalls` → `launch` + `aso` → `referrals` → `churn-prevention` → `marketing-plan` (consolidation 12 mois).

Côté APED : tout développement (landing, calculateur, paywall, Stripe/RevenueCat) passe par une story. Il faudrait un **Epic 13 « Go-to-market »** via `aped-course`/`aped-epics`.

---

## Sources

- Vidéo : https://youtu.be/Uh9A_E4ik-0 (Louis Key)
- https://github.com/coreyhaines31/marketingskills
- Finary : https://finary.com/en/pricing · https://lemediadelinvestisseur.fr/avis-et-test/finary-reduction-et-avis-sur-les-abonnements/ · https://community.finary.com/t/finary-trop-cher/29930/64
- Bankin' : https://apps.apple.com/fr/app/id447040033 · https://www.moneyvox.fr/epargne/bankin
- ProjectionLab : https://projectionlab.com/pricing · https://robberger.com/projectionlab-review
- RevenueCat, State of Subscription Apps 2026 : https://www.revenuecat.com/state-of-subscription-apps-2026/
- Banque de France, PEA 2025 : https://www.banque-france.fr/fr/statistiques/epargne/plan-depargne-en-actions-2025
- AMF, investisseurs particuliers : https://www.amf-france.org/fr/actualites-publications/actualites/le-nombre-dinvestisseurs-particuliers-sur-les-marches-atteint-un-nouveau-record-au-premier-semestre

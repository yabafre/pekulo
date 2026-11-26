# Pekulo — Plan « 50 clients payants au 31 janvier 2027 »

**Date :** 2026-11-26 · **Horizon :** 9 semaines (26 nov. 2026 → 31 janv. 2027)
**Complète :** `docs/gtm/2026-11-26-analyse-gtm-business-plan.md` · **Contexte marketing :** `.agents/product-marketing.md` (v2)

> Les hypothèses chiffrées sont marquées **[H]**. Tout développement passe par une story APED (Epic 13 proposé en §5).

---

## 1. Verdict

**Atteignable, à trois conditions :**

1. **Vendre ce qui existe déjà.** Le produit est prêt : l'écran Cap affiche « Tu atteins ton cap en {year} » / « Il manque {amount} / mois ». Il manque seulement de quoi **acheter** : landing, paiement, onboarding.
2. **Une offre fondateur à durée limitée**, vendue en direct (web + Stripe), sans attendre les stores.
3. **Se servir de la rentrée de janvier** : les résolutions financières font monter l'intention d'achat. La campagne « Fixe ton cap 2027 » vise ce pic.

**Ce qu'il ne faut PAS faire d'ici janvier :** nouvelles fonctionnalités de périmètre (AV-détail, PER, scénarios, advisory LLM), publication sur les stores, publicité payante.

**« En positif » :** 50 × 49 € = **2 450 € TTC (~2 040 € HT)**. Cela couvre environ 2 ans d'infra (~70–100 €/mois) et la licence Apple. **Condition :** que le contrat Bridge de production n'impose pas de minimum mensuel qui mange la marge (voir §7).

---

## 2. La concurrence et l'espace libre

| Acteur                                                                                            | Ce qu'il fait bien                                               | Où il laisse un trou                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finary** (Lite ~55 €/an, Plus ~150 €/an, Pro ~350 €/an)                                         | Agrégation large, communauté, simulateur Monte Carlo « Predict » | Projection **d'accumulation** donnant un âge, pas un **écart mensuel au plan**. Plaintes récurrentes : synchro (Trade Republic, néobanques), hausses de prix silencieuses, immobilier locatif limité. **Vend désormais ses propres produits** (Finary Life avec BlackRock/Generali, frais crypto 0,99–1,49 %) : question de neutralité |
| **Bankin'** (Plus ~40 €/an, Pro ~100 €/an)                                                        | Budget, catégorisation (c'est la même maison que Bridge)         | Aucun pilotage patrimonial par objectif                                                                                                                                                                                                                                                                                                |
| **Simulateurs FIRE gratuits** (S'investir, Invesse, France FIRE, Simulateur FIRE, MyFinanceTools) | Calcul du capital cible, scénarios, fiscalité                    | **Hypothétiques** : aucune donnée réelle, aucun suivi mois après mois                                                                                                                                                                                                                                                                  |
| **Tableurs** (Avenue des Investisseurs, Sinvestir)                                                | Contrôle total, gratuits                                         | Saisie manuelle, abandonnés au bout de quelques mois                                                                                                                                                                                                                                                                                   |
| **Open source** (Wealthfolio, FIRE Tracker)                                                       | Confidentialité                                                  | Pas de synchro bancaire FR, technique                                                                                                                                                                                                                                                                                                  |

**L'espace libre :** personne ne relie **un cap FIRE à tes vrais comptes, mois après mois**, de façon **neutre**. Les simulateurs ont le cap sans les données. Finary a les données sans le cap, et vend des placements.

---

## 3. Positionnement

**Catégorie :** le copilote de ton indépendance financière (rayon de recherche : « suivi FIRE », « simulateur indépendance financière », « alternative Finary »).

**Promesse :**

> **Fixe ton cap. Chaque mois, Pekulo te dit si tu es dans les temps — avec tes vrais comptes, et sans jamais te vendre un placement.**

**Trois différenciants, et rien d'autre :**

| #   | Différenciant                                                                                              | Preuve dans le produit                                       | Contre qui                                            |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 1   | **Verdict mensuel réel** : « Tu atteins ton cap en 2041 » / « Il manque 230 € / mois »                     | `hypothesis.verdict.*`, paliers, clôture mensuelle           | Simulateurs (hypothétiques), Finary (âge Monte Carlo) |
| 2   | **Neutre par construction** : aucun placement vendu, aucune commission, IA sur l'appareil ou auto-hébergée | Pas de module d'investissement ; routage LLM opt-in (Epic 6) | Finary Life, frais crypto Finary                      |
| 3   | **Tout ton patrimoine compte**, y compris le locatif net du crédit et Trade Republic par import CSV        | Epics 3, 4, 5                                                | Faiblesses connues de Finary (locatif, synchro TR)    |

**Le test « enlève le mot IA » est passé :** l'IA n'apparaît dans aucun des trois.

---

## 4. Ce qu'il faut corriger ou ajouter dans le produit

Classé par impact sur les ventes de janvier. Tailles : S ≈ ½–1 jour, M ≈ 2–3 jours **[H]**.

### P0 — sans ça, personne ne peut payer (à livrer avant le 14 déc.)

| Story                                                                                                                                                              | Pourquoi                                                                                                                                                                     | Taille |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **13-1 Landing + page tarifs** (remplace la redirection `/` → `/login`)                                                                                            | Pas de vitrine = pas de vente. Structure : promesse → ancienne vs nouvelle façon → 3 différenciants → capture d'écran du verdict → tarifs → FAQ (sécurité, neutralité) → CTA | M      |
| **13-2 Paiement Stripe + droits d'accès** (Checkout, webhook → table `subscription`, flag `plan`)                                                                  | Encaisser. _Option sans code pour les 10 premiers : Payment Link Stripe et activation manuelle_                                                                              | M      |
| **13-3 Onboarding vers le verdict** : cap (avec aide « calcule ton cap à partir de tes dépenses », règle des 25× ajustable) → 1 palier → 1 compte ou CSV → verdict | Le moment « aha » doit arriver en moins de 3 minutes ; aujourd'hui le cap reste vide tant qu'aucun palier n'existe                                                           | M      |
| **13-4 Mentions légales, CGV, droit de rétractation, factures**                                                                                                    | Obligatoire pour vendre un abonnement en ligne (14 jours de rétractation, renonciation explicite si accès immédiat)                                                          | S      |
| **13-5 Mesure du funnel** (analytics UE, consentement)                                                                                                             | Sans mesure, impossible de savoir où ça bloque                                                                                                                               | S      |

### P1 — se démarquer et garder les clients (avant le 1er janv.)

| Story                                                                                                                                                  | Pourquoi                                                                                                                                     | Taille |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **13-6 Calculateur public « Quel est ton cap ? »** (sans compte, même moteur de projection)                                                            | Aimant à prospects + SEO + contenu partageable ; il convertit les visiteurs des simulateurs gratuits                                         | M      |
| **13-7 Bilan mensuel du cap** (email le 1er du mois : verdict, écart, palier suivant)                                                                  | Règle le problème de fréquence faible et fait revenir l'utilisateur chaque mois. Le premier envoi le 1er janv. sert d'événement de lancement | M      |
| **13-8 Carte partageable + parrainage** (« Je suis à 34 % de mon cap 2045 », **sans montants**) + 1 mois offert par filleul                            | Boucle virale qui respecte la confidentialité                                                                                                | S      |
| **13-9 Paywall** : gratuit = 1 cap, 2 paliers, saisie manuelle et CSV ; Plus = synchro bancaire, paliers illimités, immobilier, bilan mensuel, clôture | Le coût variable (Bridge) passe derrière le paywall. Le paywall s'affiche après le verdict, jamais avant                                     | S      |

### Corrections rapides

- Copy : « de votre cap » → « de ton cap » (tutoiement partout).
- Page « Sécurité & neutralité » : lecture seule, agrégateur agréé ACPR, chiffrement, export et suppression RGPD, « aucun placement vendu ». C'est la réponse à l'objection n°1.

### Confiance & sécurité des premiers clients

Un client qui confie l'accès à ses comptes à une app inconnue d'un fondateur solo a trois peurs : **« mes données sont-elles en sécurité ? »**, **« puis-je partir facilement ? »**, **« et si Pekulo disparaît ? »**. Chacune doit avoir une réponse concrète **avant** l'achat.

**Déjà en place (à montrer, pas à construire) :** révocation d'une connexion Bridge, date de dernière synchro et alerte SCA expirée, export JSON complet, suppression du compte en cascade, chiffrement au repos (AES-256), cache hors ligne chiffré, isolation par utilisateur (RLS auditée), mots de passe de 12 caractères minimum et limite de tentatives, nettoyage des données personnelles dans les logs d'erreur, test de restauration des sauvegardes, notice de transparence IA.

#### A. Obligations légales — bloquantes pour encaisser (dans 13-2 / 13-4)

| Élément                                                                                                                                                                                                     | Pourquoi                                                                                                                            | Où                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Résiliation en ligne « en 3 clics »**, bouton visible en permanence                                                                                                                                       | Obligatoire depuis 2023 pour tout abonnement souscrit en ligne (loi 2022-1158, décret 2023-417)                                     | 13-2 : portail client Stripe + lien « Résilier » dans Paramètres |
| **Médiateur de la consommation** désigné et cité (site, CGV)                                                                                                                                                | Obligatoire en B2C (Code de la consommation, art. L.612-1) ; adhésion payante côté pro                                              | 13-4                                                             |
| **Rétractation 14 jours** + renonciation expresse si accès immédiat                                                                                                                                         | Vente à distance de service numérique                                                                                               | 13-4 (la garantie 30 jours la couvre déjà commercialement)       |
| **Mentions légales + CGV** (éditeur, SIRET, hébergeurs)                                                                                                                                                     | Obligatoire                                                                                                                         | 13-4                                                             |
| **SMTP personnalisé** (Brevo/Resend, domaine SPF + DKIM)                                                                                                                                                    | **Sans lui, l'expéditeur Supabase est plafonné à 2 emails/heure et les inscriptions échouent** (`docs/security.md`, « Auth flows ») | Ops, avant l'ouverture de la liste d'attente                     |
| **RGPD : cases ouvertes** de `docs/rgpd-readiness.md` — politique de confidentialité vérifiée, DPA Supabase et Bridge, liste publique des sous-traitants, consentement analytics (ou analytics sans cookie) | Le RGPD s'applique dès le premier utilisateur autre que toi                                                                         | Ops + 13-4                                                       |

#### B. Sécurité du compte — le minimum attendu d'une app financière

| Story                                       | Contenu                                                                                                                                                                                                        | Taille | Échéance |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| **13-10 Double authentification + alertes** | 2FA par application (TOTP, supporté par Supabase Auth), proposée juste après la première connexion bancaire. Emails d'alerte : nouvelle connexion bancaire, changement de mot de passe, SCA expirée (90 jours) | M      | 21 déc.  |
| **13-11 Mode discret**                      | Icône œil qui masque les montants (patrimoine total seul, ou tout), mémorisée. Finary l'a déjà ; c'est indispensable pour la carte partageable et les captures d'écran                                         | S      | 21 déc.  |
| **13-12 Durcissement du périmètre**         | Passer la CSP de Report-Only à appliquée ; publier `/.well-known/security.txt` et une page de signalement de faille                                                                                            | S      | 14 déc.  |

Plus tard (après 50 clients) : verrouillage Face ID/PIN sur mobile.

**Chiffrement et sécurité renforcée :** voir `docs/spikes/2026-11-26-securite-chiffrement-rust.md`. Ce document ajoute 4 stories :

- 13-15 : chiffrement par utilisateur et effacement cryptographique, avant le 1er janv. Il remplace le chiffrement isolé de l'IBAN ;
- 13-16 : tests d'isolation entre utilisateurs, avant le 14 déc. ;
- 13-17 : chaîne de sécurité CI, avant le 14 déc. ;
- 13-18 : journal de sécurité, avant le 1er janv.

Le même document écarte l'E2EE complet et le Rust pour la période de lancement.

#### C. Confiance avant l'achat

| Story                                                  | Contenu                                                                                                                                                                                                                                                                                                                                                                                              | Taille | Échéance       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------- |
| **13-13 Mode démo**                                    | « Essaie avec un patrimoine fictif » : le verdict, les paliers et le bilan sur des données d'exemple, **sans rien connecter**. Supprime la peur n°1 avant même l'inscription                                                                                                                                                                                                                         | M      | 14 déc.        |
| **13-14 Page « Sécurité, neutralité, réversibilité »** | Liste des mesures réelles ci-dessus ; lecture seule via Bridge (établissement de paiement agréé ACPR) ; région d'hébergement (**à vérifier dans Supabase**) ; aucune revente de données ; aucun placement vendu. **Engagement de réversibilité** : si Pekulo s'arrête, préavis de 90 jours, export complet, remboursement au prorata, code source publié (cohérent avec la rampe open source du PRD) | S      | 14 déc.        |
| Visage du fondateur                                    | Qui est derrière, photo, contact direct, feuille de route et changelog publics                                                                                                                                                                                                                                                                                                                       | —      | Landing (13-1) |

#### D. Rassurer pendant les premières semaines (sans code)

- **Onboarding personnel offert** aux membres fondateurs : 15 min en visio pour poser le cap ensemble. C'est aussi la meilleure source de verbatims.
- **Canal privé fondateurs** (Discord ou WhatsApp) et engagement de réponse sous 24 h ouvrées.
- **Transparence sur les incidents** : message dans l'app quand Bridge est indisponible (les messages existent déjà), email si un incident touche les données.
- **« Comment c'est calculé »** : un lien sous le verdict qui explique les hypothèses (rendement, effort mensuel) et rappelle que ce n'est pas un conseil. Un verdict qu'on ne comprend pas inquiète.
- **Ton uniforme** : la section « Vos données » des paramètres vouvoie (« Saisissez… »), alors que le reste de l'app tutoie. À harmoniser.

### Gel jusqu'à 50 clients

Advisory LLM (Epic 12), AV-détail, PER, scénarios multiples, crypto par API, publication sur les stores. Exception : la parité Android (10-6) en cours peut se terminer, mais elle ne conditionne pas les ventes.

---

## 5. Offre de lancement

|          | Membre fondateur 2027                                            | Après le 31 janv.      |
| -------- | ---------------------------------------------------------------- | ---------------------- |
| Prix     | **49 €/an**, garanti tant que l'abonnement reste actif           | 69 €/an ou 7,99 €/mois |
| Places   | **100**, avec un compteur réel affiché                           | —                      |
| Garantie | Satisfait ou remboursé 30 jours                                  | 14 jours (légal)       |
| Bonus    | Accès direct au fondateur (feedback), nom dans les remerciements | —                      |

- **Pas d'offre « à vie »** : la synchro Bridge coûte chaque mois, pour toujours.
- **L'urgence est vraie** : la date de fin et les 100 places ne sont pas fictives. Pas de faux compte à rebours.

---

## 6. Plan semaine par semaine

**Funnel cible [H] :** ~5 000 visiteurs → ~600 inscrits (liste d'attente ou compte) → ~250 caps posés → **50 payants** (≈ 8 % des inscrits, réaliste pour une offre fondateur auprès d'une audience chaude).

| Semaine        | Produit (APED)                                                                                            | Acquisition / vente                                                                                                                                                                          | Objectif mesurable            |
| -------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **26–30 nov.** | Décisions : prix, statut Bridge, compte Stripe, médiateur, SMTP personnalisé. `aped-epics` pour l'Epic 13 | Liste « Héros 100 » : 100 personnes ciblées (réseau, communautés FIRE, Discords, LinkedIn). Premier post « je construis Pekulo » (build in public)                                           | 100 noms listés               |
| **1–7 déc.**   | 13-1 landing avec liste d'attente, 13-5 analytics                                                         | 10 entretiens de 15 min (verbatims pour la copy). Posts LinkedIn et X ; un post de valeur sur r/vosfinances **en respectant ses règles d'autopromotion**                                     | 150 inscrits liste d'attente  |
| **8–14 déc.**  | 13-2 paiement + résiliation, 13-4 légal, 13-3 onboarding, 13-13 mode démo, 13-14 page sécurité, 13-12 CSP | **Ouverture de l'offre fondateur** à la liste d'attente et au réseau (messages personnels, pas d'envoi de masse)                                                                             | **10 payants**                |
| **15–21 déc.** | 13-6 calculateur public, 13-9 paywall, 13-10 2FA + alertes, 13-11 mode discret                            | Série de contenus « Combien pour ton cap 2027 ? » (carrousels format slide). Prise de contact avec 10 micro-créateurs finance perso (affiliation 20–30 %, mentions légales loi influenceurs) | 300 inscrits · **20 payants** |
| **22–31 déc.** | 13-7 bilan mensuel (premier envoi le 1er janv.), 13-8 carte partageable                                   | Campagne « Fixe ton cap 2027 » : email liste d'attente (J-7, J-1)                                                                                                                            | **30 payants**                |
| **1–7 janv.**  | Correctifs                                                                                                | **Jour de lancement public** : bilan mensuel envoyé, posts, communautés, Indie Hackers / LinkedIn                                                                                            | 500 inscrits · **40 payants** |
| **8–31 janv.** | Itérations selon le funnel                                                                                | Relances personnelles, parrainage, témoignages **réels** (avec accord), rappels « fin de l'offre fondateur le 31 »                                                                           | **50 payants**                |

**Signaux d'alerte et ajustements :**

- Moins de 150 inscrits au 7 déc. → problème de canal : plus de messages directs, moins de posts.
- Moins de 10 payants au 21 déc. → problème d'offre : revoir la promesse ou le prix (essai 39 €), et réinterroger les inscrits non convertis.
- Activation (cap posé) inférieure à 40 % des inscrits → problème d'onboarding (13-3) avant tout le reste.

**Rythme fondateur (méthode de la vidéo, adaptée) :** bloc de 3 h le matin pour le produit, 1 h l'après-midi pour l'acquisition (messages, contenu). On mesure chaque lundi.

---

## 7. Risques et points à trancher

| Risque                                                              | Impact                                            | Parade                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Contrat Bridge de production non signé** ou minimum mensuel élevé | Pas de synchro bancaire réelle, ou marge négative | Vendre l'offre fondateur sur **cap + CSV + immobilier**, annoncer la synchro « à l'activation », avec remboursement si elle ne vient pas. Ne **jamais** vendre une fonction absente sans le dire |
| **RGPD avec de vrais utilisateurs**                                 | Bloquant légal (`v1-definition-of-done.md` l.37)  | Contrats de sous-traitance (DPA) Supabase, Bridge, hébergeur, emailing ; politique de confidentialité à jour (la page existe)                                                                    |
| **Structure juridique**                                             | Impossible d'encaisser                            | Entité avec SIRET, régime de TVA vérifié, compte Stripe à son nom (action du fondateur)                                                                                                          |
| **Règles des communautés** (Reddit, forums)                         | Bannissement, image de spammeur                   | Contribuer avant de promouvoir ; un post « retour d'expérience de dev » plutôt qu'une publicité                                                                                                  |
| **Réglementation financière**                                       | Sanction AMF                                      | Aucune promesse de rendement, aucun conseil, aucun témoignage de gains ; mentions obligatoires avec les créateurs                                                                                |
| **Temps solo** (dev + marketing)                                    | Le plan glisse                                    | Gel du périmètre (§4) ; Payment Link manuel si 13-2 prend du retard                                                                                                                              |

---

## 8. Skills à utiliser, dans l'ordre

`copywriting` + `cro` (13-1) → `pricing` (offre fondateur) → `onboarding` (13-3) → `paywalls` (13-9) → `free-tools` (13-6) → `emails` (13-7, campagne de janvier) → `referrals` (13-8) → `launch` (1er janv.) → `customer-research` (entretiens de décembre).

---

## Sources

- Finary, prix et plaintes : https://www.noun-partners.com/analyses/avis-finary · https://magicienimpots.com/finary/finary-avis/ · https://community.finary.com/t/50-de-hausse-silencieuse-pour-un-service-non-tenu/40070
- Finary Predict : https://community.finary.com/t/predict-planifiez-votre-independance-financiere-exclu/4613 · https://sapians.com/blog/simulateur-independance-financiere
- Simulateurs FIRE FR : https://sinvestir.fr/simulateur-independance-financiere/ · https://invesse.fr/outils/simulateur-fire/ · https://myfinancetools.io/fr/suivi-independance-financiere/
- Tableurs : https://avenuedesinvestisseurs.fr/outils/ · https://sinvestir.fr/?p=31750
- Open source : https://korben.info/wealthfolio-suivi-portefeuille-bourse-crypto.html · https://github.com/funappi/Fire-tracker
- Bridge (pas de tarif public par utilisateur) : https://www.bridgeapi.io/solutions/rapprochement-bancaire-automatise-en-continu/agregateur-de-compte · https://get.bridgeapi.io/
- Résiliation en ligne : https://www.economie.gouv.fr/dgccrf/actualites/resilier-ses-contrats-conclus-sur-internet-est-desormais-plus-facile · https://www.inc-conso.fr/content/vous-pouvez-resilier-votre-contrat-dabonnement-en-quelques-clics
- Médiation de la consommation : https://entreprendre.service-public.gouv.fr/vosdroits/F33338?profil=societe · https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/la-mediation-de-la-consommation-ce-que-vous-devez-savoir
- Mode discret Finary : https://finary.com/fr/actualites-produit/mai-2021 · https://community.finary.com/t/fonctionalite-choix-masquer-total-patrimoine-seulement-tout-masquer/40227
- Attrait du FIRE en France (OpinionWay, 18 % des actifs) : https://finalib.fr/blog/patrimoine-epargne/fire-mouvement-2026-independance-financiere-france-strategie

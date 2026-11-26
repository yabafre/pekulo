# Spike — Chiffrement, sécurité renforcée, Rust et E2EE

**Date :** 2026-11-26 · **Statut :** proposition. Les décisions retenues deviendront des ADR via `aped-arch` (ADR-0019 et suivants).
**Lu :** `docs/security.md`, `docs/architecture.md`, ADR-0003, ADR-0013, ADR-0015, ADR-0018, `apps/api/src/common/derive/*`.

---

## 0. Verdicts en une ligne

| Sujet                                                        | Verdict                             | Pourquoi                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E2EE complet**                                             | **Non**                             | Incompatible avec ce qui fait la valeur de Pekulo : synchro Bridge serveur quand l'utilisateur est hors ligne, bilan mensuel par email, catégorisation, calcul du verdict. Un mot de passe oublié = données perdues sans recours |
| **Chiffrement par utilisateur + effacement cryptographique** | **Oui, avant l'ouverture publique** | Protège contre une fuite de la base ou des sauvegardes, rend la suppression de compte effective jusque dans les backups. Le volume actuel est minuscule : c'est le moment le moins cher pour le faire                            |
| **Sécurité robuste**                                         | **Oui, par ordre de risque**        | Le risque n°1 n'est pas la crypto mais l'accès d'un utilisateur aux données d'un autre (une seule barrière aujourd'hui côté API)                                                                                                 |
| **Rust**                                                     | **Pas avant 50 clients**            | Mesuré : le pire calcul envisagé (Monte Carlo) prend 70–95 ms en Bun. Les lenteurs de Pekulo viennent du réseau et de la base, pas du CPU                                                                                        |
| **E2EE ciblé (« coffre privé »)**                            | **Plus tard, en option**            | Pertinent pour des notes ou des documents que le serveur n'a jamais besoin de lire                                                                                                                                               |

---

## 1. Ce qui existe déjà

- TLS 1.2+ (Vercel, Caddy sur Dokploy) ; HSTS preload prévu à l'ouverture publique.
- Base Supabase chiffrée au repos (AES-256, chiffrement disque).
- Jetons Bridge conservés côté Bridge (Pekulo ne stocke pas d'identifiants bancaires).
- Cache hors ligne de la PWA chiffré (IndexedDB, clé dérivée par Web Crypto), effacé à la déconnexion.
- Jetons mobiles dans le Keychain (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`).
- Isolation des données : règle de lint `no-prisma-query-without-user-id` + `where: { userId }` obligatoire ; RLS active sur 100 % des tables, mais **contournée par le rôle service de l'API** (ADR-0013).
- Contrôles CI : audit RLS des migrations, chemin de suppression en cascade, scan des secrets au pre-commit.
- Nettoyage des données personnelles dans les remontées d'erreurs (GlitchTip) ; test de restauration des sauvegardes.
- Webhook Bridge signé (HMAC) ; limites de débit par utilisateur sur l'API, et sur la connexion.

**La faiblesse réelle :** une personne qui obtient un dump de la base, une sauvegarde ou l'URL `DATABASE_URL` lit tout en clair (IBAN, libellés de transactions avec des noms de personnes, adresses des biens). Le chiffrement disque ne protège que contre le vol physique du disque.

---

## 2. E2EE : pourquoi non, et ce qu'on peut faire à la place

### 2.1 Ce qui casserait

| Fonction                                        | Besoin côté serveur                                            |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Synchro Bridge (cron + webhook)                 | Écrire des transactions quand l'utilisateur n'est pas connecté |
| Bilan mensuel du 1er du mois (13-7)             | Calculer le verdict et l'envoyer par email sans l'utilisateur  |
| Règle des virements internes, agrégats mensuels | Lire les montants et les comptes                               |
| Catégorisation (Ollama / API tierce)            | Lire les libellés                                              |
| Support client                                  | Comprendre un problème signalé                                 |
| Récupération de compte                          | Un mot de passe oublié = clé perdue = données perdues          |

`docs/security.md` (« Encryption strategy ») avait déjà écarté le zero-knowledge pour ces raisons. La recherche confirme ce choix.

### 2.2 Le risque marketing

Annoncer « chiffrement de bout en bout » alors que le serveur calcule sur les données serait **faux**, et c'est une pratique commerciale trompeuse. Ce qu'on peut dire honnêtement est en §6.

### 2.3 E2EE ciblé (V2, option)

Un « coffre privé » chiffré côté client (clé dérivée d'une passkey ou d'une phrase secrète) pour ce que le serveur n'a **jamais** besoin de lire : notes libres, documents (actes, contrats de prêt), objectifs personnels détaillés. C'est un bon argument premium, sans casser le reste.

---

## 3. Recommandation chiffrement : clé par utilisateur + effacement cryptographique

### 3.1 Principe (envelope encryption)

```
KEK (clé maîtresse, HORS base)  ──chiffre──▶  DEK utilisateur (1 par compte, en base, chiffrée)
DEK utilisateur                 ──chiffre──▶  champs sensibles de cet utilisateur
```

- **KEK** : stockée hors de Postgres. D'abord en variable d'environnement Dokploy (versionnée `KEK_V1`, `KEK_V2`…), puis dans un KMS hébergé en UE (Scaleway Key Manager, OVH KMS ou AWS KMS eu-west-3) quand le volume le justifie. Supabase avertit que garder les clés dans la même base que les données est dangereux, et **pgsodium est en voie de dépréciation** : on ne l'utilise pas.
- **DEK** : 32 octets aléatoires par utilisateur, stockée chiffrée par la KEK dans une table `user_keys` (`user_id`, `wrapped_dek`, `kek_version`).
- **Algorithme** : AES-256-GCM via `node:crypto` (natif dans Bun) ou XChaCha20-Poly1305 via libsodium. Ne **jamais** écrire sa propre primitive cryptographique.
- **Intégration** : une extension Prisma qui chiffre à l'écriture et déchiffre à la lecture des champs listés, sur le modèle de l'extension `prefixed-ids` existante. Coût : quelques microsecondes par champ.

### 3.2 Quels champs chiffrer

| Chiffrer                                                            | Laisser en clair (et pourquoi)                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| IBAN, numéros de compte                                             | Montants : agrégats SQL, verdict, cron. Sans identifiants, ils sont pseudonymes |
| Libellés bruts des transactions (contiennent des noms de personnes) | Catégorie, marchand normalisé : filtres et logos                                |
| Adresse et notes des biens immobiliers                              | Valeur, crédit, loyers : calculs                                                |
| Notes libres, noms d'affichage personnalisés                        | Dates, identifiants techniques                                                  |

Pour un champ chiffré qu'il faut comparer (dédoublonner un IBAN), on ajoute un **index aveugle** (HMAC-SHA-256 avec une clé dédiée).

### 3.3 L'argument fort : l'effacement cryptographique

À la suppression du compte, on **détruit la DEK**. Les copies de ses données restées dans les sauvegardes (PITR, dumps) deviennent illisibles. Cela répond proprement à la question RGPD « et les sauvegardes ? », et c'est un message de confiance concret : **« ta suppression est définitive, même dans nos sauvegardes »**.

### 3.4 Coût et calendrier

Story M à L (3–4 jours) : table `user_keys`, extension Prisma, migration des données existantes (quelques comptes aujourd'hui), effacement de la DEK dans la suppression de compte (11-2), rotation de la KEK, tests. **À faire avant l'ouverture publique** : chiffrer après coup des milliers de comptes est beaucoup plus risqué.

---

## 4. Sécurité robuste — plan par ordre de risque

### P0 — avant d'encaisser (≤ 14 déc.)

| Mesure                                                                                                                                                   | Risque couvert                                                                         | Taille            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| **Tests automatisés d'isolation entre utilisateurs** : pour chaque route oRPC, l'utilisateur B tente d'accéder aux identifiants de A → doit échouer      | Fuite d'un client vers un autre (IDOR), le risque n°1 avec une seule barrière côté API | S–M               |
| **Chaîne de sécurité CI** : scan des dépendances (osv-scanner), analyse statique (Semgrep ou CodeQL), mises à jour automatiques (Renovate ou Dependabot) | Faille connue dans une dépendance                                                      | S                 |
| **Webhook Stripe signé** et rejoué de façon idempotente                                                                                                  | Faux paiements, double activation                                                      | inclus dans 13-2  |
| **CSP appliquée** (aujourd'hui Report-Only), HSTS preload, `security.txt`                                                                                | XSS, détournement                                                                      | inclus dans 13-12 |
| **Revue de sécurité outillée** avant l'ouverture : scan Claude Security (`/claude-security`) + checklist OWASP                                           | Failles non vues                                                                       | S                 |
| Vérifier le **niveau de sauvegarde Supabase** (PITR, rétention) et la région d'hébergement                                                               | Perte de données, conformité                                                           | XS                |

### P1 — avant le lancement public (≤ 1er janv.)

| Mesure                                                                                                                                                                                             | Taille |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Chiffrement par utilisateur + effacement cryptographique** (§3)                                                                                                                                  | M–L    |
| **2FA TOTP + alertes** (13-10). Supabase propose les **passkeys en bêta depuis mai 2026** : passkeys plus tard, quand elles sortiront de bêta                                                      | M      |
| **Journal de sécurité visible** (connexions, nouvel appareil, export, banque connectée ou révoquée, suppression), append-only selon le modèle d'ADR-0001, + **« déconnecter tous les appareils »** | M      |
| Limites de débit renforcées sur l'export, la connexion bancaire et la réinitialisation du mot de passe                                                                                             | S      |

### P2 — après 50 clients

- Deuxième barrière d'isolation dans la base : rejouer ADR-0013 (rôle Postgres non privilégié + RLS appliquée par requête) si les tests d'isolation révèlent un risque ou si l'équipe grandit.
- Verrouillage Face ID / code sur mobile + flou dans le sélecteur d'apps.
- Test d'intrusion externe (budget ~1,5–5 k€ [H]) quand le chiffre d'affaires le permet, puis programme de bug bounty (ex. YesWeHack).
- Coffre privé E2EE (§2.3).

---

## 5. Rust : où, quand, comment

### 5.1 Mesure

Le moteur de projection actuel (`compass-curve.ts`, `projection-curve.ts`, `hypothesis-gap.ts`) fait moins de 100 lignes chacun et calcule une trajectoire déterministe : quelques microsecondes.

Benchmark du **pire cas envisagé** (scénarios Monte Carlo de la phase 3 du PRD), en Bun sur la machine de dev :

```
10 000 trajectoires × 40 ans × 12 mois = 4 800 000 pas
→ 70–95 ms (2 exécutions)
```

Rust ou WASM descendrait vers ~10–20 ms **[H]**, un gain invisible pour l'utilisateur et lent à rentabiliser. Les vrais temps d'attente sont ailleurs : requêtes Postgres, appels Bridge, fournisseurs de cours (I/O).

### 5.2 Où Rust aurait un vrai sens (plus tard)

| Cas                                                            | Intérêt réel                                                                                                                                                                                                                     | Condition de déclenchement                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Moteur de projection partagé** web + iOS + Android + serveur | **Un seul code de calcul** pour 4 surfaces, donc le même verdict partout. L'intérêt est l'exactitude plus que la vitesse. Outil : `uniffi-bindgen-react-native` (module natif Turbo pour React Native, wasm-bindgen pour le web) | Quand le calcul hors ligne sur mobile devient nécessaire, ou quand les scénarios Monte Carlo arrivent |
| Calcul **sur l'appareil** pour le coffre E2EE                  | Calculer sans que le serveur voie les données                                                                                                                                                                                    | Si le coffre E2EE est construit                                                                       |
| Import de très gros fichiers (années d'historique CSV)         | Parsing rapide                                                                                                                                                                                                                   | Si un import dépasse quelques secondes, mesuré                                                        |

**Piège à connaître :** Hermes (le moteur JS de React Native) annonce un support WebAssembly récent, mais rien ne confirme encore qu'il soit utilisable dans une app React Native de production. Pour le mobile, il faut un **module natif** (uniffi), pas du WASM.

**Règle d'adoption :** on introduit Rust seulement si (1) le p95 du dashboard dépasse 300 ms (objectif M1 du PRD) **et** (2) un profil montre que c'est le CPU et non l'I/O, ou si le moteur partagé devient un besoin produit. Sinon on garde un seul langage (TypeScript) : c'est plus rapide à faire évoluer pour un fondateur solo.

### 5.3 Ce qu'il ne faut pas faire en Rust

La cryptographie maison. On utilise `node:crypto` / WebCrypto / libsodium, qui sont déjà natifs et audités.

---

## 6. Ce qu'on peut dire aux clients (honnête et vérifiable)

**Oui :**

- « Tes données sont chiffrées en transit et au repos. »
- « Tes informations les plus sensibles (IBAN, libellés, adresses) sont chiffrées avec une clé propre à ton compte, stockée séparément. » _(une fois §3 livré)_
- « Quand tu supprimes ton compte, ta clé est détruite : tes données deviennent illisibles, même dans nos sauvegardes. » _(une fois §3 livré)_
- « Accès bancaire en lecture seule via Bridge, établissement agréé ACPR, révocable en un clic. »
- « Double authentification disponible. » _(une fois 13-10 livré)_

**Non :**

- « Chiffrement de bout en bout. »
- « Même nous ne pouvons pas lire tes données. »
- « Sécurité de niveau bancaire » (formule creuse, à éviter).

---

## 7. Stories à ajouter à l'Epic 13

| Story | Contenu                                                                            | Taille | Échéance  |
| ----- | ---------------------------------------------------------------------------------- | ------ | --------- |
| 13-15 | Chiffrement par utilisateur (envelope) + effacement cryptographique + rotation KEK | M–L    | 1er janv. |
| 13-16 | Tests automatisés d'isolation entre utilisateurs sur toutes les routes oRPC        | S–M    | 14 déc.   |
| 13-17 | Chaîne de sécurité CI (dépendances, analyse statique, mises à jour)                | S      | 14 déc.   |
| 13-18 | Journal de sécurité visible + déconnexion de tous les appareils                    | M      | 1er janv. |

**Charge totale de l'Epic 13 :** environ 18 stories, soit ~30 jours de dev [H] sur 9 semaines, en parallèle de l'acquisition. Si ça glisse, l'ordre de sacrifice est : 13-18, 13-8 (carte partageable), 13-6 (calculateur public). Les P0 de sécurité et 13-15 ne glissent pas.

**Prochaine étape APED :** `aped-arch` pour acter ADR-0019 (chiffrement par utilisateur) et la règle d'adoption de Rust, puis `aped-epics` pour l'Epic 13.

---

## Sources

- Supabase, passkeys (bêta, mai 2026) : https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta · https://supabase.com/docs/guides/auth/passkeys
- Supabase, pgsodium en voie de dépréciation et Vault : https://supabase.com/docs/guides/database/extensions/pgsodium · https://supabase.com/blog/supabase-vault
- React Native 0.84, Hermes V1 : https://reactnative.dev/blog/2026/02/11/react-native-0.84
- Rust dans React Native (uniffi) : https://hacks.mozilla.org/2024/12/introducing-uniffi-for-react-native-rust-powered-turbo-modules/ · https://jhugman.github.io/uniffi-bindgen-react-native/print.html
- Benchmark : script `mc-bench.ts` exécuté le 2026-11-26 avec Bun 1.3.13 (version locale) (scratchpad de session, non versionné)

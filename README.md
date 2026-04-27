# pekulo

Personal finance dashboard — capital tracking, multi-currency portfolio, holdings history.

> *Pekulo* — du latin *peculium*, "le pécule", l'épargne mise de côté.

Suivi mois par mois de l'épargne, des dépenses, des transactions, et d'un portefeuille (Livret A, PEA, CTO, AV) avec ETF et actions. Cours rafraîchis automatiquement, devise normalisée en EUR, historique des achats/ventes pour le calcul de prix moyen pondéré.

---

## Stack

- **Monorepo** — Bun + Turborepo, 2 apps (`apps/web`, `apps/prices`)
- **Web** — Next.js 16 (Turbopack) + React 19 + Tailwind 4 + shadcn × base-ui
- **Data** — Supabase (Postgres + Auth + RLS sur toutes les tables)
- **Forms / mutations** — TanStack Form + zod + ZapAction (`defineAction` avec tags + revalidate)
- **Charts** — Recharts via `ChartContainer` shadcn (donut allocation, capital, scénarios, annuel)
- **Prix** — chaîne de fallback à 4 niveaux : `apps/prices` (Python yfinance sur VPS) → `yahoo-finance2` (npm) → scraping Boursorama → Twelve Data
- **FX** — frankfurter.app (taux ECB, gratuit, base EUR)
- **Prices service** — FastAPI + yfinance + curl_cffi (déployable via Dokploy/Docker)

## Layout

```
.
├── apps/
│   ├── web/                 # Next.js 16 — dashboard + auth + tables
│   └── prices/              # FastAPI + yfinance — service de prix temps réel
├── docs/
│   ├── quick-specs/         # 10 specs APED qui ont produit la version actuelle
│   └── state.yaml
├── package.json             # workspaces ["apps/web"], scripts dotenv-prefixed
├── turbo.json               # pipelines dev/build/lint/check-types
├── .env.example             # tous les vars (Supabase, prices service, Twelve Data)
└── bun.lock
```

## Quick start (local)

Prérequis : Bun ≥ 1.3, Python ≥ 3.10 (optionnel pour le service prix), un projet Supabase.

```bash
# 1. Cloner + installer
git clone git@github.com:yabafre/pekulo.git
cd pekulo
bun install

# 2. Configurer l'env (copier puis remplir)
cp .env.example .env.local
# Renseigne au minimum :
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Provisionner la base
# Ouvre Supabase Studio → SQL Editor → exécute apps/web/supabase-schema.sql

# 4. Lancer le dev (à la racine)
bun run dev
# → Next.js sur http://localhost:3000
```

Première connexion : login Supabase, puis `/dashboard/parametres` pour saisir tes hypothèses (salaire, charges, taux ETF), puis `/dashboard/portefeuille` pour ajouter comptes + holdings.

### Service de prix Python (optionnel local)

```bash
cd apps/prices
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Test
curl http://localhost:8000/health
curl "http://localhost:8000/quote?symbol=PE500.PA"
```

Si ton IP est rate-limitée par Yahoo (souvent le cas en EU), le service fallback automatiquement sur Boursorama côté Next.js. En production sur ton VPS via Dokploy, l'IP différente bypass le rate-limit.

## Pages

| Route | Rôle |
|---|---|
| `/dashboard` | KPI strip + charts + capital actuel vs projeté |
| `/dashboard/parametres` | Hypothèses éditables (salaire, charges, ETF perf, etc.) |
| `/dashboard/mensuel` | 60 mois projetés/réels avec écart cumulé |
| `/dashboard/transactions` | Entrées/sorties + imprévus, filtrables |
| `/dashboard/portefeuille` | Comptes + holdings + AllocationChart + refresh prix |
| Bouton historique sur chaque holding | Lots achat/vente, prix moyen pondéré dérivé |

## Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Clé anon Supabase |
| `PRICES_SERVICE_URL` | optionnel | URL du service Python (sinon fallback yahoo-finance2 + Boursorama) |
| `PRICES_SERVICE_TOKEN` | optionnel | Bearer token, si le service est protégé |
| `TWELVE_DATA_API_KEY` | optionnel | Free tier 800 req/jour, fallback US uniquement |

Voir `.env.example` pour les détails.

## Architecture du fallback de prix

```
fetchPriceQuote({ ticker, currency, kind })
       │
       ├─① Python service (apps/prices, déployé sur VPS Dokploy)
       │     PRICES_SERVICE_URL → yfinance + curl_cffi
       │
       ├─② yahoo-finance2 (npm) — gère consent EU + crumb auto
       │
       ├─③ Boursorama scraping — pour Euronext FR (PE500, CW8, etc.)
       │     /recherche/?query=<TICKER> → redirect vers la page canonique
       │
       └─④ Twelve Data — fallback US uniquement (free tier sans EU)

→ Premier provider qui répond gagne. Cache 60s par symbole.
→ Si tous échouent : PriceError composite avec le détail par provider.
```

## Architecture des holdings & lots

- `accounts` — Livret A, PEA, CTO, AV — devise + cash balance
- `holdings` — ETF/actions liés à un compte — qty + avg_cost + last_price
- `holding_lots` — historique buy/sell — qty/price/fees/date

Quand un holding a des lots, `qty` et `avg_cost` deviennent **dérivés** (moyenne pondérée) à chaque mutation. Un holding sans lots reste en saisie manuelle.

## Specs

Le projet a été construit en 10 quick-specs APED, tous documentés dans `docs/quick-specs/`. Suivre l'ordre chronologique pour comprendre l'évolution :

1. `hypotheses-editor` — paramètres éditables, foundation
2. `monthly-actuals` — saisie mois par mois
3. `transactions-imprevus` — CRUD transactions
4. `placements-foundation` — comptes + holdings (qs-04a)
5. `placements-yahoo` — auto-refresh prix v1 (qs-04b)
6. `placements-yahoo-fallbacks` — Yahoo crumb + Twelve Data (qs-04b-bis)
7. `placements-prices-rewrite` — yahoo-finance2 + Python sidecar (qs-04b-final)
8. `placements-fx` — multi-devises via frankfurter (qs-04c)
9. `placements-lots` — historique buy/sell + dérivation auto (qs-04d)
10. `monorepo-migration` — Bun + Turborepo + .env racine

## Déploiement

- **`apps/web`** → Vercel (recommandé, Next.js natif). Pousser depuis `main`. Configurer les vars d'env Supabase + (optionnel) `PRICES_SERVICE_URL` + `TWELVE_DATA_API_KEY`.
- **`apps/prices`** → Dokploy ou n'importe quel runtime Docker. Build context : `apps/prices/`. Voir `apps/prices/README.md` pour les détails.

## License

Privé. Tous droits réservés.

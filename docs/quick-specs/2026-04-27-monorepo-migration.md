# Quick Spec: Monorepo migration (Bun + Turborepo)

**Date:** 2026-04-27
**Author:** Alex
**Type:** refactor (infra)
**Status:** done

## What

Restructure the repo from two flat sibling folders into a Bun-managed Turborepo monorepo. Single `.env` at the root loaded into every command via `dotenv-cli`. Done in 4 separately-testable phases so we never break the dev loop for more than ~5 min at a time.

```
Before                                After
test/                                 test/
├── plan-financier/                   ├── apps/
├── prices-service/                   │   ├── web/      (was plan-financier)
├── docs/                             │   └── prices/   (was prices-service)
├── .aped/                            ├── docs/                 (unchanged)
└── ...                               ├── .aped/                (unchanged)
                                      ├── package.json          (workspaces)
                                      ├── turbo.json
                                      ├── bun.lock
                                      ├── .env.example          (consolidated)
                                      └── .env.local            (gitignored)
```

## Why

- `prices-service/` (Python) and `plan-financier/` (Next.js) coexist in this repo and will likely deploy together. A monorepo lets us share env, scripts, and CI config without duplication.
- Bun is faster than npm for install/run on this stack (Next 16 + many deps). Officially supported by Next.js team (both Vercel).
- Turborepo gives a single `bun run dev` that spawns both apps in parallel + caches builds. Owned by Vercel, first-class Next.js integration.
- Single root `.env` removes the "which file holds what?" pain when both apps share Supabase/service URL/token.

## Acceptance Criteria

- [ ] `bun install` at root installs both `apps/web` deps. `apps/prices` is Python — not bun-managed but lives in the repo.
- [ ] `bun run dev` from root starts Next.js on `:3000` (and optionally Python on `:8000`) in parallel via Turborepo.
- [ ] Single `.env.local` at root provides Supabase URLs, `PRICES_SERVICE_URL`, `PRICES_SERVICE_TOKEN`, etc. — read by both apps via `dotenv-cli`.
- [ ] Existing routes (`/dashboard`, `/dashboard/parametres`, `/dashboard/mensuel`, `/dashboard/transactions`, `/dashboard/portefeuille`) still work.
- [ ] Type-check + lint clean post-migration.
- [ ] Dokploy build context updated to `apps/prices/` (documented in spec result; user updates Dokploy panel).
- [ ] `.aped/config.yaml` and `docs/` stay at root untouched.

## Stack decisions (validated by user)

- **(a) loose env** — single `.env` at root, no per-app validation, no `t3-env`-style strict types. Turborepo picks it up naturally.
- **`bun.lock`** (text format, git-diff-friendly).
- **Root scripts prefixed with `dotenv -e .env --`** so every command receives the root env. No per-app `.env` files (except `.env.example` for documentation).
- **Staged** rollout, 4 phases each independently testable.

## Phases

### Phase 1 — Bun in place (no folder move yet)

Goal: verify Bun handles the existing Next.js + Tailwind 4 + base-ui + ZapAction stack.

- In `plan-financier/`: `rm -rf node_modules package-lock.json`
- `bun install` (creates `bun.lock`)
- `bun run dev` → Next.js on :3000 still works
- Smoke: navigate to `/dashboard/portefeuille`, click 🔄 → Boursorama still responds

**Files touched**: `package-lock.json` (deleted), `bun.lock` (created), `node_modules/` (rebuilt). `package.json` unchanged.

### Phase 2 — Folder restructure

Goal: move both apps into `apps/`. App-internal paths unchanged.

- `mkdir apps`
- `git mv plan-financier apps/web` (or `mv` if not in git yet)
- `mv prices-service apps/prices`
- Verify `apps/web/bun run dev` from inside still works (sanity)
- Verify Dockerfile build context still works: `cd apps/prices && docker build .` (optional)

**Files touched**: every file inside the two folders is moved (mass `mv`, no content changes). `.aped/config.yaml` may need a path update if it references `plan-financier/` or `prices-service/`.

### Phase 3 — Root workspace + Turborepo

Goal: root `bun run dev` spawns both apps in parallel.

- Create root `package.json`:
  ```json
  {
    "name": "test",
    "private": true,
    "workspaces": ["apps/*"],
    "scripts": {
      "dev": "dotenv -e .env -- turbo dev",
      "dev:web": "dotenv -e .env -- turbo dev --filter=web",
      "dev:prices": "cd apps/prices && uvicorn main:app --reload --port 8000",
      "build": "dotenv -e .env -- turbo build",
      "lint": "turbo lint",
      "typecheck": "turbo typecheck"
    },
    "devDependencies": {
      "turbo": "^2",
      "dotenv-cli": "^8"
    }
  }
  ```
- Add `apps/web/package.json` `name: "web"` (rename from `plan-financier`).
- Create root `turbo.json`:
  ```json
  {
    "$schema": "https://turborepo.com/schema.json",
    "tasks": {
      "dev": { "cache": false, "persistent": true },
      "build": { "outputs": [".next/**", "!.next/cache/**"] },
      "lint": {},
      "typecheck": {}
    }
  }
  ```
- `apps/web/package.json` scripts unchanged (`dev`, `build`, `lint`).
- `bun install` from root resolves the new workspace.
- `bun run dev` should boot Next.js (Python is started separately via `bun run dev:prices`).

**Note on `dev:prices`**: Python isn't a Bun workspace. We expose it as a top-level script that the user runs in a separate terminal when they want the Python service running locally. Turborepo can also run it via an `exec` task if we want — TBD if needed.

### Phase 4 — Env consolidation

Goal: one `.env.local` at root for both apps.

- Move `apps/web/.env.local` → `.env.local` at root
- Append Python service vars to root `.env.example` (`PRICES_SERVICE_TOKEN`, `ALLOWED_ORIGIN`)
- `apps/prices/.env.example` becomes a documentation-only stub pointing at the root file
- Add `.env.local` to root `.gitignore`
- Sanity: `bun run dev` boots Next.js with all Supabase calls working (env loaded via `dotenv-cli`)

## Files to Change

**Created (root, ~5)**

- `package.json` (workspaces + scripts)
- `turbo.json` (pipelines)
- `.env.example` (consolidated)
- `.gitignore` updates
- `bun.lock` (auto-generated)

**Edited / renamed**

- `plan-financier/` → `apps/web/`
- `prices-service/` → `apps/prices/`
- `apps/web/package.json` (name renamed `web`, lockfile path delta)
- `apps/web/.gitignore` (drop `node_modules` entry — handled at root, optional)
- `.aped/config.yaml` (verify no path references break)

**Deleted**

- `plan-financier/package-lock.json`
- per-app `.env.local` files (consolidated to root)

→ ~10 files net delta + 2 mass folder moves.

## Test Plan

After **each phase**:

- `bun run dev` (or equivalent) boots without error.
- `/dashboard/portefeuille` loads, click 🔄 on a holding → Boursorama returns a price.
- `npx tsc --noEmit` clean (in `apps/web/` for Phase 1, from root via `bun run typecheck` for Phase 3+).

After phase 4:

- Login flow works (Supabase env loaded).
- Refresh prices works (PRICES_SERVICE_URL passed through if set).
- Dokploy build can still be triggered (build context = `apps/prices/`, user updates Dokploy panel manually).

## Risks & Mitigations

- **Bun + native deps**: shadcn `@base-ui/react`, recharts, @zapaction/\* — all pure JS/TS. Should work. **Mitigation**: if `bun install` fails, fall back to `bun install --backend=hardlink` or revert Phase 1.
- **Next.js + monorepo**: Turbopack handles workspaces fine since v15. Next 16 is OK.
- **`.env` discovery from monorepo root**: Next.js by default reads from app's cwd. We force-feed via `dotenv-cli` prefix in root scripts. **Mitigation**: if Next can't find vars, double-check `dotenv-cli` is loading the right path (`-e .env` resolves to root cwd).
- **APED config**: `.aped/config.yaml` references default paths. Verify after Phase 2.
- **Dokploy**: build context changes path. **Mitigation**: documented in spec result, user updates panel.

## Open Questions

(All resolved by user.)

1. ✅ Single root `.env` (loose), no per-app strict env.
2. ✅ `bun.lock` text format.
3. ✅ Root scripts prefixed with `dotenv -e .env --`.
4. ✅ Staged rollout.

## Result

**Phases done:** 4/4. Total time: ~10 min wall clock.

**Layout finale:**

```
test/
├── apps/
│   ├── web/         (Next.js, name=web)
│   └── prices/      (FastAPI + yfinance)
├── docs/, .aped/    (unchanged at root)
├── package.json     (workspaces=["apps/web"], dotenv-prefixed scripts)
├── turbo.json       (dev/build/lint/typecheck pipelines)
├── .env.example     (consolidated, documented)
├── .env.local       (gitignored, layered after .env)
├── .gitignore       (root-level)
└── bun.lock         (text format)
```

**Scripts (root):**

- `bun run dev` → `dotenv -c -e .env -e .env.local -- turbo dev` → spawns Next.js with full env
- `bun run dev:prices` → starts the Python service in `apps/prices/` with same env
- `bun run build` / `lint` / `typecheck` → all routed through Turborepo

**Env strategy:**

- `dotenv-cli -c -e .env -e .env.local --` layers root files (Next.js convention; .env.local wins).
- No per-app `.env` files. Both Next.js and Python read root.
- Verified: NEXT_PUBLIC_SUPABASE_URL (40 chars), TWELVE_DATA_API_KEY (32 chars) propagate correctly through the pipeline.

**Verifications passed:**

- `bun install` workspace install OK (1403 packages, hoisted).
- `bun run typecheck` → `web:typecheck` cache hit second run (FULL TURBO).
- Existing lint errors are pre-existing (theme-provider, auth-form, kpi-card) — not introduced by migration.

**Dokploy update needed (manual):** build context for Python service changes from `prices-service/` → `apps/prices/`. Update in Dokploy panel before next deploy.

**Carry-over:** all subsequent quick-specs assume `apps/web/...` paths (e.g., `apps/web/src/lib/...`).

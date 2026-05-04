# `@pekulo/api` — Pekulo domain API

Bun + Elysia HTTP service. See [ADR-0009](../../docs/adr/0009-elysia-orpc-with-zapaction-bridge.md) for the architectural rationale.

## Status

This package is the **scaffold from story `0-3-api-scaffold`**, extended in `0-4-prisma-setup` with the Prisma 7.8 data layer. Only the `health` module ships routes (`/health`, `/ready`). Domain modules land in subsequent stories:

| Module    | Story  | Status      |
| --------- | ------ | ----------- |
| Prisma    | `0-4`  | wired       |
| oRPC      | `0-5`  | scaffolded  |
| OTel      | `0-7`  | scaffolded  |
| Compass   | `1-1`  | scaffolded  |
| Accounts  | `2-1`  | scaffolded  |
| Holdings  | `3-1`  | scaffolded  |

(See `docs/epics.md` for the full sprint list.)

## Local development

```bash
# From the repo root:
bun install                                # registers @pekulo/api in the workspace
( cd apps/api && bun run dev )             # bun --hot src/main.ts
curl -fsS http://127.0.0.1:3001/health     # → 200 {"status":"ok"}
( cd apps/api && bun run typecheck )       # → tsc --noEmit (exit 0)
```

> ⚠️ Do NOT use `bun --cwd apps/api dev`. Per `docs/lessons.md` (entry 2026-05-04), Bun 1.3.13 silently drops the script invocation when `--cwd` is placed after `run` (or before a script-name shorthand). Use the `( cd apps/api && bun run <script> )` form everywhere.

## Environment variables

Validated via Zod at boot in `src/config/env.ts`:

| Name       | Required | Default       | Notes                         |
| ---------- | -------- | ------------- | ----------------------------- |
| `NODE_ENV` | no       | `development` | one of `development` / `production` / `test` |
| `PORT`     | no       | `3001`        | 1–65535                       |
| `HOST`     | no       | `127.0.0.1`   | bind interface                |
| `DATABASE_URL` | yes  | —             | Postgres connection string (Prisma + readiness probe) |

Future stories will extend the schema (Supabase JWT secret in 0-5 ; OTel endpoint in 0-7).

## Database setup (Prisma 7.8)

See [ADR-0012](../../docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md) (schema folder + prefixed IDs) and [ADR-0014](../../docs/adr/0014-prisma-migrations.md) (Prisma migrate as the schema-change toolchain).

### 1. Start the local Postgres (Supabase CLI)

The local dev DB is a Docker-backed Supabase Postgres on `127.0.0.1:54322`. It ships the `auth` schema (`auth.users` + `auth.uid()`) referenced by the brownfield RLS DDL — no separate Postgres install is needed.

```bash
(cd apps/web && bunx supabase start)
```

> ⚠️ The Supabase CLI auto-applies the legacy migrations under `apps/web/supabase/migrations/` to the local DB on first start. Those use `UUID` PKs while Prisma's baseline uses prefixed-`TEXT` PKs, so the two schemas are incompatible. For local dev, drop the public schema before applying Prisma's baseline:
>
> ```bash
> docker exec supabase_db_web psql -U postgres -d postgres -c \
>   'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; \
>    GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;'
> ```

### 2. Configure `apps/api/.env.local`

Create the file with this single line (gitignored):

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 3. Generate the Prisma client + apply migrations

```bash
(cd apps/api && bun run prisma:generate)
(cd apps/api && bun run prisma:migrate:deploy)
```

### 4. Verify RLS coverage

```bash
(cd apps/api && bun run db:rls-audit)
```

Expected: `[rls-audit] OK — 7 tables checked: kpis (3 policies), monthly_tracking (3 policies), …`.

### Day-to-day Prisma commands

| Command | What it does |
|---------|--------------|
| `bun run prisma:generate`       | Regenerate the Prisma client into `apps/api/generated/prisma/`. |
| `bun run prisma:migrate:dev`    | Author a new migration locally — runs `prisma migrate dev`. |
| `bun run prisma:migrate:deploy` | Apply pending migrations to `DATABASE_URL` (production-safe). |
| `bun run prisma:migrate:status` | Show which migrations are applied vs pending. |
| `bun run prisma:format`         | Format every `*.prisma` file. |
| `bun run prisma:validate`       | Validate the schema folder. |
| `bun run db:rls-audit`          | Probe the deployed schema for RLS coverage on the 7 brownfield tables. |

### Schema migration discipline (ADR-0014)

- Forward-only. Reversal is a new forward migration.
- Every new user-scoped table includes 4 RLS policies appended manually to the migration SQL (Prisma does not introspect Postgres policies).
- Audit tables (future: `compass_history`, `real_estate_valuations`, `llm_call_log`) include only INSERT + SELECT policies (append-only enforcement).
- `prisma:migrate:deploy` runs in the Dokploy deploy hook; never `migrate dev` outside development.

## Docker

```bash
# Build (from the repo root — context is the workspace root, not apps/api/):
docker build -f apps/api/Dockerfile -t pekulo-api:dev .

# Run:
docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev
curl -fsS http://127.0.0.1:3001/health     # → 200 {"status":"ok"}
docker inspect --format='{{.State.Health.Status}}' pekulo-api-test  # → healthy

# Cleanup:
docker stop pekulo-api-test
```

## Dokploy deploy

Mount `apps/api` behind the existing Caddy reverse proxy. Operator-applied snippet at [`deploy/Caddyfile.snippet`](./deploy/Caddyfile.snippet) — paste into the Dokploy Caddy config and bind upstream to the `pekulo-api` container on port 3001.

Per architecture (Phase 3 — Deployment topology):

- `apps/api` → Dokploy on the existing VPS, behind Caddy.
- `apps/prices` → reachable only via internal Docker network from `apps/api` (no public port).
- `apps/web` → Vercel.

## Skeleton layout

```
apps/api/
├── Dockerfile
├── README.md
├── deploy/Caddyfile.snippet
├── package.json
├── prisma.config.ts                     (Prisma 7+ — datasource.url + schema/migrations paths)
├── prisma/
│   ├── schema/                          (multi-file Prisma schema folder)
│   │   ├── _base.prisma                 (datasource + generator)
│   │   ├── enums.prisma
│   │   ├── accounts.prisma
│   │   ├── monthly.prisma
│   │   ├── hypothesis.prisma
│   │   └── transactions.prisma
│   └── migrations/
│       └── 0_baseline_brownfield/migration.sql
├── scripts/
│   └── rls-audit.ts                     (probes pg_tables + pg_policies)
├── tsconfig.json
└── src/
    ├── main.ts                          (entry, top-level await)
    ├── app.ts                           (Elysia + module mounts)
    ├── bootstrap/
    │   ├── lifecycle.ts                 (SIGTERM/SIGINT + Prisma disconnect)
    │   ├── readiness.ts                 (probe registry consumed by /ready)
    │   └── runtime-dependencies.ts      (composition root + prismaService)
    ├── common/index.ts                  (placeholder — populated 0-5 → 0-7)
    ├── config/env.ts                    (Zod env schema)
    ├── database/                        (Prisma client + extensions — story 0-4)
    │   ├── index.ts                     (re-exports)
    │   ├── prisma.service.ts            (PrismaPg adapter + extension chain)
    │   ├── prefixed-ids.extension.ts    (Trafi pattern wiring)
    │   ├── prefixed-ids.injector.ts     (pure injector)
    │   ├── id-prefixes.config.ts        (14-entry registry — ADR-0012)
    │   └── base62.ts                    (random base62 helper)
    ├── modules/
    │   └── health/                      (Elysia-native /health + /ready)
    └── platform/index.ts                (placeholder — populated 0-5/0-6/0-7)
```

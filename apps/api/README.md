# `@pekulo/api` — Pekulo domain API

Bun + Elysia HTTP service. See [ADR-0009](../../docs/adr/0009-elysia-orpc-with-zapaction-bridge.md) for the architectural rationale.

## Status

This package is the **scaffold from story `0-3-api-scaffold`**. Only the `health` module ships routes (`/health`, `/ready`). Domain modules land in subsequent stories:

| Module    | Story  | Status      |
| --------- | ------ | ----------- |
| Prisma    | `0-4`  | scaffolded  |
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

Future stories will extend the schema (Prisma `DATABASE_URL` in 0-4 ; Supabase JWT secret in 0-5 ; OTel endpoint in 0-7).

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
├── tsconfig.json
└── src/
    ├── main.ts                          (entry, top-level await)
    ├── app.ts                           (Elysia + module mounts)
    ├── bootstrap/
    │   ├── lifecycle.ts                 (SIGTERM/SIGINT graceful stop)
    │   ├── readiness.ts                 (probe registry consumed by /ready)
    │   └── runtime-dependencies.ts      (composition root)
    ├── common/index.ts                  (placeholder — populated 0-4 → 0-7)
    ├── config/env.ts                    (Zod env schema)
    ├── database/index.ts                (placeholder — populated by story 0-4)
    ├── modules/
    │   └── health/                      (Elysia-native /health + /ready)
    └── platform/index.ts                (placeholder — populated 0-5/0-6/0-7)
```

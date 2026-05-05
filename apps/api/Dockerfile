# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
# `openssl` is required by Prisma's query engine on debian-slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

# F16: hand /app to the non-root `bun` user (uid=1000) BEFORE the heavy
# COPY+install layers, then drop privileges. Each subsequent COPY uses
# `--chown=bun:bun` so we never pay a final recursive `chown -R bun:bun /app`
# layer that walks tens of thousands of node_modules inodes (was a 200MB+
# layer carrying only metadata changes).
RUN chown bun:bun /app
USER bun

# Copy lockfile + ALL workspace manifests for cache-friendly frozen install.
# `bun install --frozen-lockfile` requires every workspace member declared in the
# root `workspaces` glob to have its package.json present, otherwise Bun reports
# "lockfile had changes" and aborts. apps/prices has no package.json (Python
# workspace, ignored by Bun's glob). Lesson 2026-05-04 (L1) — load-bearing.
COPY --chown=bun:bun package.json bun.lock turbo.json ./
COPY --chown=bun:bun apps/api/package.json apps/api/
COPY --chown=bun:bun apps/web/package.json apps/web/
COPY --chown=bun:bun packages packages

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
# `--ignore-scripts` skips lifecycle scripts (notably apps/api's `postinstall: prisma generate`,
# added in story 0-8 for CI/local DX): the schema isn't yet in the image at this layer
# (cache-friendly pattern: package.json BEFORE prisma/), so the postinstall would fail.
# The explicit `bunx prisma generate` step below handles generation once the schema is copied.
# See L8 in docs/lessons.md for the full rationale.
RUN bun install --frozen-lockfile --ignore-scripts

# Copy Prisma config + schema BEFORE generate so the generator can read both.
# Prisma 7+ requires prisma.config.ts (datasource.url moved out of the .prisma files).
COPY --chown=bun:bun apps/api/prisma.config.ts apps/api/
COPY --chown=bun:bun apps/api/prisma apps/api/prisma

# Generate the Prisma client into apps/api/generated/prisma (gitignored locally,
# baked into the image here so the runtime never calls `prisma generate` itself).
# DATABASE_URL is required at config-load time by prisma.config.ts even for
# `prisma generate`, so a placeholder keeps the build hermetic. The build
# context excludes every .env* via Dockerfile.dockerignore, so the only env
# Prisma sees here is this single inline ARG.
RUN cd apps/api && DATABASE_URL=postgresql://placeholder:placeholder@build/db bunx prisma generate

# Copy app sources.
COPY --chown=bun:bun apps/api/tsconfig.json apps/api/
COPY --chown=bun:bun apps/api/src apps/api/src
COPY --chown=bun:bun apps/api/scripts apps/api/scripts

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

# F17: bumped start-period from 10s to 20s — covers Prisma client load
# (~50MB module graph) on cold-cache CI / Dokploy slow disks. The 30s probe
# interval × 3 retries still yields a 100s wall-clock buffer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]

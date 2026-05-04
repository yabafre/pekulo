# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
# `openssl` is required by Prisma's query engine on debian-slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + ALL workspace manifests for cache-friendly frozen install.
# `bun install --frozen-lockfile` requires every workspace member declared in the
# root `workspaces` glob to have its package.json present, otherwise Bun reports
# "lockfile had changes" and aborts. apps/prices has no package.json (Python
# workspace, ignored by Bun's glob). Lesson 2026-05-04 (L1) — load-bearing.
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages packages

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
RUN bun install --frozen-lockfile

# Copy Prisma config + schema BEFORE generate so the generator can read both.
# Prisma 7+ requires prisma.config.ts (datasource.url moved out of the .prisma files).
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

# Generate the Prisma client into apps/api/generated/prisma (gitignored locally,
# baked into the image here so the runtime never calls `prisma generate` itself).
# DATABASE_URL is required at config-load time by prisma.config.ts even for
# `prisma generate`, so a placeholder keeps the build hermetic.
RUN cd apps/api && DATABASE_URL=postgresql://placeholder:placeholder@build/db bunx prisma generate

# Copy app sources.
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

# Drop privileges. `oven/bun:slim` ships a non-root `bun` user (uid=1000).
# chown is run as root before the USER switch so the runtime can read installed
# deps + the generated Prisma client.
RUN chown -R bun:bun /app
USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]

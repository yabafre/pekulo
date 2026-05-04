# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + manifests first for cache-friendly install.
COPY package.json bun.lock turbo.json ./
COPY packages/tsconfig packages/tsconfig
COPY apps/api/package.json apps/api/

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
RUN bun install --frozen-lockfile

# Copy app sources.
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]

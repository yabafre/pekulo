// Prisma 7+ replaces the package.json#prisma block + the schema-level
// `datasource.url = env(...)` with this file.
// See https://www.prisma.io/docs/orm/reference/prisma-config-reference

import { config as dotenvConfig } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Pekulo monorepo convention (project-context.md): env files live at the REPO
// ROOT only, not under apps/api. Resolve the root from this file's location
// (apps/api/prisma.config.ts → ../..) so the loader works regardless of the
// current working directory (`bun run …` from apps/api, `prisma migrate
// deploy` from root, Docker WORKDIR /app/apps/api, etc.).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

// Load .env.local first (developer-local override), then .env (committed
// defaults). Both are gitignored unless the file is .env.example.
//
// Surface dotenv parse errors so a malformed .env.local doesn't silently fall
// through to a confusing "DATABASE_URL not set" downstream. ENOENT is expected
// (the files are optional in CI / docker builds with placeholder env) — only
// log the actual parse failures.
function loadDotenv(filename: string): void {
  const path = resolve(REPO_ROOT, filename);
  const result = dotenvConfig({ path });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.warn(`[prisma.config] dotenv failed to load ${path}: ${result.error.message}`);
  }
}
loadDotenv(".env.local");
loadDotenv(".env");

// Migration / CLI datasource resolution (story 2-1 deviation):
//   - DATABASE_URL points to the Supabase TRANSACTION pooler (port 6543) —
//     fine for the app runtime's connection pool but HANGS indefinitely on
//     long-running CLI commands like `prisma migrate deploy` (story 1-1's
//     `migrate dev` hang precedent extended).
//   - DIRECT_URL points to the session pooler (port 5432) or a direct
//     connection — safe for migrations / introspection.
//
// Prisma 7's defineConfig datasource block only accepts `url` (no separate
// `directUrl` field like the schema-block syntax), so we resolve here: prefer
// DIRECT_URL when set, fall back to DATABASE_URL otherwise. The runtime
// PrismaClient (apps/api/src/database/prisma.service.ts) still reads
// DATABASE_URL directly — this swap only affects CLI commands that read
// prisma.config.ts.
type Env = {
  DATABASE_URL: string;
  DIRECT_URL?: string;
};

const migrationDatasourceUrl = process.env.DIRECT_URL
  ? env<Required<Env>>("DIRECT_URL")
  : env<Env>("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationDatasourceUrl,
  },
});

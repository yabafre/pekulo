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

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});

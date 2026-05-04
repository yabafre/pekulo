// Prisma 7+ replaces the package.json#prisma block + the schema-level
// `datasource.url = env(...)` with this file.
// See https://www.prisma.io/docs/orm/reference/prisma-config-reference

import { config as dotenvConfig } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (developer-local override), then .env (committed defaults).
// Both are gitignored unless the file is .env.example.
//
// F13: surface dotenv parse errors so a malformed .env.local doesn't silently
// fall through to a confusing "DATABASE_URL not set" downstream. ENOENT is
// expected (the file is optional in CI / docker builds with placeholder env)
// — only log the actual parse failures.
function loadDotenv(path: string): void {
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

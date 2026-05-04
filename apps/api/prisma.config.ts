// Prisma 7+ replaces the package.json#prisma block + the schema-level
// `datasource.url = env(...)` with this file.
// See https://www.prisma.io/docs/orm/reference/prisma-config-reference

import { config as dotenvConfig } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (developer-local override), then .env (committed defaults).
// Both are gitignored unless the file is .env.example.
dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

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

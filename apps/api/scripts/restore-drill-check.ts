// restore-drill-check.ts — post-restore assertion suite (NFR-21, story 11-6).
//
// Run it AFTER restoring a production snapshot into the staging Supabase
// project and AFTER booting apps/api against that restored database. It is
// read-only apart from one password grant and one settings.get call.
//
// Required env (root .env.local, pointing at STAGING):
//   DATABASE_URL                      — restored staging Postgres
//   SUPABASE_URL                      — staging project URL
//   RESTORE_DRILL_SUPABASE_ANON_KEY   — staging anon key
//   RESTORE_DRILL_EMAIL               — an auth.users row that survived
//   RESTORE_DRILL_PASSWORD            — that user's password
//
// Optional env:
//   RESTORE_DRILL_API_BASE_URL        — defaults to http://127.0.0.1:3001
//
// Exit 0 = the restore is usable. Exit 1 = at least one assertion failed;
// every failure is printed before exiting.
//
// Usage: `bun run scripts/restore-drill-check.ts`
//        (registered as `db:restore-drill-check` in package.json)

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_POLICY_COUNTS, auditRls } from "./rls-audit";
import {
  evaluateAuthUsers,
  evaluateMigrationParity,
  evaluateNullUserIds,
  quoteIdentifier,
  type NullUserIdRow,
} from "./restore-drill-lib";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "apps", "api", "prisma", "migrations");

for (const filename of [".env.local", ".env"]) {
  const result = dotenvConfig({ path: resolve(REPO_ROOT, filename) });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.warn(`[restore-drill] dotenv failed to load ${filename}: ${result.error.message}`);
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`[restore-drill] ${name} is required`);
  return value;
}

function optionalBaseUrl(): string {
  return (process.env.RESTORE_DRILL_API_BASE_URL?.trim() || "http://127.0.0.1:3001").replace(
    /\/$/,
    "",
  );
}

function countCommittedMigrations(): number {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .length;
}

async function main(): Promise<number> {
  const databaseUrl = required("DATABASE_URL");
  const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
  const anonKey = required("RESTORE_DRILL_SUPABASE_ANON_KEY");
  const email = required("RESTORE_DRILL_EMAIL");
  const password = required("RESTORE_DRILL_PASSWORD");
  const apiBaseUrl = optionalBaseUrl();

  const client = new Client({ connectionString: databaseUrl });
  const failures: string[] = [];
  const lines: string[] = [];

  try {
    await client.connect();

    const committed = countCommittedMigrations();
    const applied = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const appliedCount = Number(applied.rows[0]?.count ?? "0");
    failures.push(...evaluateMigrationParity(committed, appliedCount));
    lines.push(`migrations: ${committed} committed / ${appliedCount} applied`);

    const rls = await auditRls(client);
    if (rls.drift.length > 0) failures.push(...rls.drift.map((line) => `rls ${line.trim()}`));
    lines.push(`rls: ${rls.checked} tables, ${rls.drift.length} drifted`);

    const nullRows: NullUserIdRow[] = [];
    for (const table of Object.keys(EXPECTED_POLICY_COUNTS)) {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(table)} WHERE "user_id" IS NULL`,
      );
      nullRows.push({ table, null_count: result.rows[0]?.count ?? "0" });
    }
    const nullFailures = evaluateNullUserIds(nullRows);
    failures.push(...nullFailures);
    lines.push(`user_id: ${nullRows.length} tables, ${nullFailures.length} with NULL rows`);

    const auth = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM auth.users`,
    );
    const authCount = auth.rows[0]?.count ?? "0";
    failures.push(...evaluateAuthUsers(authCount));
    lines.push(`auth.users: ${authCount} rows`);
  } finally {
    await client.end().catch(() => {});
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });

  const authBody = (await authResponse.json().catch(() => ({}))) as { access_token?: string };
  if (authResponse.status !== 200) {
    failures.push(`auth round-trip: HTTP ${authResponse.status}`);
  }
  if (!authBody.access_token) {
    failures.push("auth round-trip: response carried no access_token");
  } else {
    lines.push(`auth round-trip: 200 for ${email}`);
  }

  if (authBody.access_token) {
    const rpcResponse = await fetch(`${apiBaseUrl}/rpc/v1/settings/get`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authBody.access_token}`,
      },
      body: JSON.stringify({ json: {} }),
    });
    const rpcBody = (await rpcResponse.json().catch(() => ({}))) as {
      json?: { theme?: unknown };
    };
    if (rpcResponse.status !== 200) {
      failures.push(`orpc: HTTP ${rpcResponse.status} from ${apiBaseUrl}/rpc/v1/settings/get`);
    }
    if (typeof rpcBody.json?.theme !== "string") {
      failures.push("orpc: settings.get returned no theme");
    }
    if (rpcResponse.status === 200 && typeof rpcBody.json?.theme === "string") {
      lines.push(`orpc: 200 settings.get (theme=${rpcBody.json.theme})`);
    }
  } else {
    failures.push("orpc: skipped because the auth round-trip produced no token");
  }

  if (failures.length > 0) {
    console.error("[restore-drill] FAIL:");
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }

  console.log(`[restore-drill] OK — ${lines.length} checks passed`);
  for (const line of lines) console.log(`  ${line}`);
  return 0;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("[restore-drill] error:", err);
      process.exit(1);
    });
}

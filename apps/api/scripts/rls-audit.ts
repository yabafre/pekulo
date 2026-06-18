// rls-audit.ts — CLI probe that asserts brownfield RLS coverage.
//
// Connects to DATABASE_URL via `pg`, queries pg_tables + pg_policies for the
// 7 brownfield tables, and reports either OK (all RLS-enabled with the expected
// policy counts) or a diff. Exit 0 on success, 1 on drift.
//
// Usage: `bun run scripts/rls-audit.ts`
//        (registered as `db:rls-audit` script in package.json)
//
// Story 0-8 will lift this into a CI job; the V1 (a) personal-use version lives
// here to prove AC-3 of story 0-4.

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env";

// Pekulo monorepo convention: env files live at the REPO ROOT only. Resolve
// the root from this file's location (apps/api/scripts/rls-audit.ts → ../../..)
// so the script works regardless of cwd. Same pattern as prisma.config.ts.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
for (const filename of [".env.local", ".env"]) {
  const result = dotenvConfig({ path: resolve(REPO_ROOT, filename) });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.warn(`[rls-audit] dotenv failed to load ${filename}: ${result.error.message}`);
  }
}

const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
  // compass_history is an audit sister table per ADR-0001 — INSERT + SELECT
  // only, no UPDATE/DELETE policies. AC-6 of story 1-1 asserts this count.
  compass_history: 2,
  // milestones is a regular CRUD table — full quartet (SELECT/INSERT/UPDATE/DELETE).
  // AC-12 of story 1-2 asserts this count.
  milestones: 4,
  // account_balance_log is an audit sister table per ADR-0001 — INSERT + SELECT
  // only. AC-2 of story 2-2 asserts this count.
  account_balance_log: 2,
  // real_estate aggregate — 3 CRUD tables (full quartet) + 1 audit sister
  // (INSERT + SELECT only per ADR-0001). AC-6 of story 4-1 asserts these counts.
  real_estate: 4,
  real_estate_mortgage: 4,
  real_estate_rental: 4,
  real_estate_valuations: 2,
  // monthly_records — CRUD table for monthly aggregate overrides (story 5-4).
  // Full quartet. AC-3 of story 5-4 asserts per-row RLS isolation.
  monthly_records: 4,
  // bank_connections — CRUD table for Bridge OAuth connections (story 5-6).
  // Full quartet. NFR-8 + ADR-0013 — per-row isolation. Token columns are
  // vault.secrets FKs, never exposed via oRPC DTO.
  bank_connections: 4,
  // bridge_users — mapping Pekulo userId ↔ Bridge user UUID (story 5-6 FIX,
  // post-smoke-test). Immutable per-user row; SELECT + INSERT only (no
  // UPDATE/DELETE use-case), so the audit shape is the 2-policy sister-table
  // variant.
  bridge_users: 2,
  // llm_call_log — append-only audit sister table per ADR-0001 (NFR-26 / DR-6).
  // SELECT + INSERT only, no UPDATE/DELETE. AC-5 of story 6-1 asserts this count.
  llm_call_log: 2,
  // llm_opt_in — per-user third-party opt-in (story 6-1). Mutable per-user
  // state → full quartet. AC-5 of story 6-1 asserts this count.
  llm_opt_in: 4,
  // user_pref — per-user UI preferences singleton (story 8-2, FR-51/FR-52).
  // One row/user, PK user_id. SELECT/INSERT/UPDATE only — NO DELETE policy
  // (a pref reset overwrites via UPDATE; row removal only via auth.users
  // cascade, story 11-2). AC-7 of story 8-2 asserts exactly this 3-policy count.
  user_pref: 3,
};

async function main(): Promise<number> {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL });
  // F11: connect inside the try so a failing connect (wrong DATABASE_URL,
  // network down) still hits the cleanup path and `client.end()` doesn't leak.
  try {
    await client.connect();
    const tableNames = Object.keys(EXPECTED_POLICY_COUNTS);
    const tables = await client.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables
       WHERE schemaname = 'public' AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [tableNames],
    );
    const policies = await client.query<{ tablename: string; count: string }>(
      `SELECT tablename, COUNT(*)::text AS count FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1::text[])
       GROUP BY tablename
       ORDER BY tablename`,
      [tableNames],
    );

    const tablesByName = new Map(tables.rows.map((r) => [r.tablename, r.rowsecurity]));
    const policiesByName = new Map(policies.rows.map((r) => [r.tablename, Number(r.count)]));

    const drift: string[] = [];
    const summary: string[] = [];
    for (const table of tableNames) {
      const rls = tablesByName.get(table);
      const count = policiesByName.get(table) ?? 0;
      const expected = EXPECTED_POLICY_COUNTS[table]!;
      if (rls === undefined) {
        drift.push(`  ${table}: MISSING (table not found in public schema)`);
      } else if (rls !== true) {
        drift.push(`  ${table}: RLS DISABLED (rowsecurity=false)`);
      } else if (count !== expected) {
        drift.push(`  ${table}: ${count} policies (expected ${expected})`);
      } else {
        summary.push(`${table} (${count} policies)`);
      }
    }

    if (drift.length > 0) {
      console.error("[rls-audit] DRIFT:");
      for (const line of drift) console.error(line);
      return 1;
    }
    console.log(`[rls-audit] OK — ${tableNames.length} tables checked: ${summary.join(", ")}`);
    return 0;
  } finally {
    // Swallow end() errors — at this point we've either reported drift or
    // success ; a failing teardown should not flip the exit code.
    await client.end().catch(() => {});
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[rls-audit] error:", err);
    process.exit(1);
  });

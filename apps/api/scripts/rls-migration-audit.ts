// rls-migration-audit.ts — static RLS gate (story 11-3, AC-1).
//
// Parses the committed migration SQL — NO database needed — and fails the build
// if any public user-data table is created without `ENABLE ROW LEVEL SECURITY`
// + at least the minimum policy set. Catches the exact mistake the runtime
// rls-audit.ts cannot: a brand-new table whose RLS DDL was forgotten (RLS DDL
// is appended MANUALLY to migration SQL — Prisma does not introspect policies;
// see ADR-0014, architecture.md:128).
//
// Runtime/post-deploy drift (exact policy counts) is still covered by
// `apps/api/scripts/rls-audit.ts` (DB-backed). This script is the CI-friendly gate.
//
// Usage: `bun run scripts/rls-migration-audit.ts`  (script `db:rls-migration-audit`)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Public tables that legitimately hold NO user data (no RLS expected).
// Adding an entry here is a conscious, reviewable decision.
//
// Story 6-10 (FR-65): the logo caches are global brand/bank reference data
// keyed by a normalised merchant key / Bridge provider_id — no user_id, no FK
// to auth.users. Their protective layer is simply that they hold no PII.
const NON_USER_TABLES = new Set<string>(["merchant_logo_cache", "provider_logo_cache"]);

// Minimum policies a user-data table must declare. Audit sister tables
// (append-only) ship 2 (INSERT+SELECT); CRUD tables ship 4. The static gate
// asserts the floor; exact 2-vs-4 counts are the runtime rls-audit's job.
const MIN_POLICIES = 2;

// Bare (public-schema) CREATE TABLE capture. Quotes optional so a hand-appended
// unquoted `CREATE TABLE leaky (...)` is still caught; the trailing `\s*\(` keeps
// schema-qualified names like "vault"."secrets" out (no paren follows the name).
// NOT captured (Prisma never emits them): `PARTITION OF` — inherits the parent's
// RLS — and `CREATE TABLE ... AS SELECT` — no paren. A hand-migration using either
// must assert its RLS via the DB-backed rls-audit; this static gate can't see it.
const CREATE_TABLE_RE = /CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?\s*\(/gi;

function createdTables(sql: string): Set<string> {
  const created = new Set<string>();
  for (const m of sql.matchAll(CREATE_TABLE_RE)) created.add(m[1]!);
  return created;
}

export interface RlsDrift {
  table: string;
  reason: string;
}

// Pure core — exported so the gate is unit-testable without the file walk or
// process.exit. Bare (public-schema) CREATE TABLE only: a schema-qualified name
// like "vault"."secrets" carries a `"."` the [a-z0-9_]+ class never matches.
export function auditMigrationSql(
  sql: string,
  opts: { nonUser?: Set<string>; minPolicies?: number } = {},
): RlsDrift[] {
  const nonUser = opts.nonUser ?? NON_USER_TABLES;
  const minPolicies = opts.minPolicies ?? MIN_POLICIES;

  const created = createdTables(sql);
  const rlsEnabled = new Set<string>();
  for (const m of sql.matchAll(/ALTER TABLE "([a-z0-9_]+)"\s+ENABLE ROW LEVEL SECURITY/gi)) {
    rlsEnabled.add(m[1]!);
  }
  const policyCount = new Map<string, number>();
  for (const m of sql.matchAll(/CREATE POLICY [^;]*?\sON "([a-z0-9_]+)"/gi)) {
    policyCount.set(m[1]!, (policyCount.get(m[1]!) ?? 0) + 1);
  }

  const drift: RlsDrift[] = [];
  for (const table of [...created].sort()) {
    if (nonUser.has(table)) continue;
    if (!rlsEnabled.has(table)) {
      drift.push({ table, reason: "missing ENABLE ROW LEVEL SECURITY" });
      continue;
    }
    const count = policyCount.get(table) ?? 0;
    if (count < minPolicies) {
      drift.push({ table, reason: `${count} policies (need >= ${minPolicies})` });
    }
  }
  return drift;
}

function migrationSqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...migrationSqlFiles(full));
    } else if (entry === "migration.sql") {
      out.push(full);
    }
  }
  return out;
}

function main(): number {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(here, "..", "prisma", "migrations");
  // Aggregate across ALL migration files — a table may be created in one and
  // have its RLS enabled in a later one (e.g. reenable_rls_drifted_tables).
  const files = migrationSqlFiles(migrationsDir);
  if (files.length === 0) {
    // Fail closed: an empty corpus must never report a green ("0 tables OK"),
    // which would silently pass if the migrations dir is ever excluded from a
    // checkout or the path regresses.
    console.error(`[rls-migration-audit] no migration.sql found under ${migrationsDir}`);
    return 1;
  }
  const sql = files.map((f) => readFileSync(f, "utf8")).join("\n");

  const drift = auditMigrationSql(sql);
  if (drift.length > 0) {
    console.error("[rls-migration-audit] DRIFT — user-data tables without proper RLS:");
    for (const d of drift) console.error(`  ${d.table}: ${d.reason}`);
    console.error(
      "\nAppend the RLS DDL to the table's migration.sql (ENABLE ROW LEVEL SECURITY + policies),",
    );
    console.error("or add the table to NON_USER_TABLES with a justification.");
    return 1;
  }
  const checked = [...createdTables(sql)].filter((t) => !NON_USER_TABLES.has(t)).length;
  console.log(`[rls-migration-audit] OK — ${checked} user-data tables, all RLS-guarded.`);
  return 0;
}

if (import.meta.main) process.exit(main());

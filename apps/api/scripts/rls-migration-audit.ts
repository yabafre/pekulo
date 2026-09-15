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

// Public tables that legitimately hold NO user data, so they carry no RLS
// POLICIES and the audit skips them. Adding an entry here is a conscious,
// reviewable decision.
//
// Story 6-10 (FR-65): the logo caches are global brand/bank reference data
// keyed by a normalised merchant key / Bridge provider_id — no user_id, no FK
// to auth.users. RLS is nonetheless ENABLED on them (migration 20260602150000)
// with NO policies = deny-all to the anon PostgREST role (Supabase linter 0013);
// apps/api's service-role connection bypasses RLS so reads/writes are unaffected.
// They stay allow-listed here because deny-all (0 policies) is intentional — not
// the >= 2 policies a user-data table must declare.
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

// --- Cascade reachability gate (story 11-2, AC-5) -------------------------
//
// RLS proves who may READ a row. It says nothing about whether the row DIES
// when the account does. Four tables (compass_history, milestones, user_pref,
// dashboard_layout) shipped with no FK to auth.users at all while three of
// their migrations carried a comment claiming the opposite — an incomplete
// GDPR erasure (FR-50) that every gate in the repo passed. This closes that
// class: a user-data table must reach auth.users through ON DELETE CASCADE,
// directly or through a parent that does (the account_balance_log shape).

// `FOREIGN KEY ("col") REFERENCES <target> ON DELETE CASCADE`, with or without
// quotes and with or without a schema qualifier. Captures the target table
// name only; the ON DELETE CASCADE tail is mandatory, so a SET NULL / RESTRICT
// / NO ACTION reference simply does not match and the table stays unreachable.
const CASCADE_FK_RE =
  /ALTER TABLE\s+(?:"?[a-z0-9_]+"?\.)?"?([a-z0-9_]+)"?\s+ADD CONSTRAINT[^;]*?FOREIGN KEY[^;]*?REFERENCES\s+(?:"?([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?\s*\([^)]*\)\s*ON DELETE CASCADE/gi;

export function auditCascadeReachability(
  sql: string,
  opts: { nonUser?: Set<string> } = {},
): RlsDrift[] {
  const nonUser = opts.nonUser ?? NON_USER_TABLES;
  const created = createdTables(sql);

  // child -> set of parents it cascade-deletes from.
  const parents = new Map<string, Set<string>>();
  for (const m of sql.matchAll(CASCADE_FK_RE)) {
    const child = m[1]!;
    const parentSchema = m[2];
    const parentTable = m[3]!;
    // auth.users is the root. Any other schema qualifier is not a public
    // table we track, and an unqualified name is public by definition.
    const parent = parentSchema === "auth" && parentTable === "users" ? "auth.users" : parentTable;
    if (!parents.has(child)) parents.set(child, new Set());
    parents.get(child)!.add(parent);
  }

  // Walk up from each table; `seen` makes a cyclic FK graph terminate
  // instead of recursing forever.
  function reachesAuthUsers(table: string, seen: Set<string>): boolean {
    if (seen.has(table)) return false;
    seen.add(table);
    for (const parent of parents.get(table) ?? []) {
      if (parent === "auth.users") return true;
      if (reachesAuthUsers(parent, seen)) return true;
    }
    return false;
  }

  const drift: RlsDrift[] = [];
  for (const table of [...created].sort()) {
    if (nonUser.has(table)) continue;
    if (!reachesAuthUsers(table, new Set())) {
      drift.push({
        table,
        reason: "no ON DELETE CASCADE path to auth.users (GDPR erasure would orphan it)",
      });
    }
  }
  return drift;
}

// Exported so the unit test can assert the gate against the real corpus
// rather than against hand-written SQL only.
export function readAllMigrationSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(here, "..", "prisma", "migrations");
  const files = migrationSqlFiles(migrationsDir);
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
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

  // Story 11-2, AC-5 — erasure reachability. Kept as a SECOND pass with its
  // own message: "RLS is missing" and "the account cascade cannot reach it"
  // are different bugs with different fixes, and collapsing them into one
  // report sends the reader to the wrong file.
  const cascadeDrift = auditCascadeReachability(sql);
  if (cascadeDrift.length > 0) {
    console.error(
      "[rls-migration-audit] DRIFT — user-data tables the account cascade cannot reach:",
    );
    for (const d of cascadeDrift) console.error(`  ${d.table}: ${d.reason}`);
    console.error(
      '\nAdd `FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE`',
    );
    console.error(
      "to the table's migration.sql, or give it a parent FK that cascades (see account_balance_log),",
    );
    console.error("or add the table to NON_USER_TABLES with a justification.");
    return 1;
  }

  const checked = [...createdTables(sql)].filter((t) => !NON_USER_TABLES.has(t)).length;
  console.log(
    `[rls-migration-audit] OK — ${checked} user-data tables, all RLS-guarded and all reachable by the auth.users cascade.`,
  );
  return 0;
}

if (import.meta.main) process.exit(main());

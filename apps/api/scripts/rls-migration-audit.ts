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

// An ALTER TABLE statement is a comma-separated list of clauses (`ADD
// COLUMN …, ADD CONSTRAINT …, DROP CONSTRAINT …`). Prisma emits one clause
// per statement, but a hand-written migration may not, and a regex that runs
// across the whole statement can pair one clause's REFERENCES with the next
// clause's ON DELETE CASCADE (aped-review 11-2). So: split the corpus into
// statements, each statement into clauses, and read each clause alone.
const ALTER_TABLE_HEAD_RE = /ALTER TABLE\s+(?:ONLY\s+)?(?:"?[a-z0-9_]+"?\.)?"?([a-z0-9_]+)"?\s+/i;
// Column lists carry commas too; a clause boundary is a comma followed by a
// clause keyword.
const CLAUSE_SPLIT_RE = /,\s*(?=(?:ADD|DROP|ALTER|RENAME|VALIDATE)\s)/i;
// `ADD CONSTRAINT name FOREIGN KEY (…) REFERENCES parent(…) [ON UPDATE …]
// ON DELETE CASCADE`, quotes and schema qualifier optional. The ON DELETE
// CASCADE tail is mandatory, so SET NULL / RESTRICT / NO ACTION simply do not
// match and the table stays unreachable. Accepts ONLY, ON UPDATE in either
// position and an upper-cased schema (five valid shapes used to read as
// drift, fail-closed but undocumented).
const ADD_CASCADE_FK_RE =
  /ADD CONSTRAINT\s+"?([a-z0-9_]+)"?\s+FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s+(?:"?([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?\s*\([^)]*\)[^;]*?ON DELETE CASCADE/i;
// `DROP CONSTRAINT [IF EXISTS] name`. A dropped cascade must stop counting:
// the corpus already carries two FK drops (re-added with CASCADE today), and
// a future `DROP …; ADD … ON DELETE RESTRICT` on a user FK must fail the
// gate, not pass it.
const DROP_CONSTRAINT_RE = /DROP CONSTRAINT\s+(?:IF EXISTS\s+)?"?([a-z0-9_]+)"?/i;

// Column-level shorthand inside CREATE TABLE: `"user_id" UUID NOT NULL
// REFERENCES auth.users(id) ON DELETE CASCADE`. Prisma emits ALTER TABLE, but a
// hand-written migration may inline it; the constraint gets Postgres' default
// name, `<table>_<column>_fkey`, which is what a later DROP CONSTRAINT names.
const INLINE_FK_RE =
  /"?([a-z0-9_]+)"?\s+[a-z0-9_() ]+?\s+(?:NOT NULL\s+)?REFERENCES\s+(?:"?([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?\s*\([^)]*\)[^,)]*?ON DELETE CASCADE/gi;
const CREATE_TABLE_BODY_RE = /CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\);/gi;

interface CascadeEdge {
  child: string;
  constraint: string;
  parent: string;
}

function toParent(schema: string | undefined, table: string): string {
  // auth.users is the root. Any other schema qualifier is not a public table
  // we track, and an unqualified name is public by definition. Case-folded:
  // SQL identifiers are case-insensitive unless quoted, and Prisma never
  // quotes `auth`.
  return schema?.toLowerCase() === "auth" && table.toLowerCase() === "users"
    ? "auth.users"
    : table.toLowerCase();
}

// Statements are replayed in corpus order, so a constraint added in one
// migration and dropped in a later one ends up absent — exactly what the
// database ends up with. A `DO $$ … $$` block splits on its inner semicolons
// too; the ALTER TABLE inside it is found by search, not anchored, and the
// BEGIN / EXCEPTION / END fragments match nothing.
function collectCascadeEdges(sql: string): CascadeEdge[] {
  const events: Array<{
    at: number;
    add?: CascadeEdge;
    drop?: { child: string; constraint: string };
  }> = [];

  let offset = 0;
  for (const statement of sql.split(";")) {
    const at = offset;
    offset += statement.length + 1;
    const head = ALTER_TABLE_HEAD_RE.exec(statement);
    if (!head) continue;
    const child = head[1]!.toLowerCase();
    const clauses = statement.slice(head.index + head[0].length).split(CLAUSE_SPLIT_RE);
    for (const clause of clauses) {
      const add = ADD_CASCADE_FK_RE.exec(clause);
      if (add) {
        events.push({
          at,
          add: { child, constraint: add[1]!.toLowerCase(), parent: toParent(add[2], add[3]!) },
        });
        continue;
      }
      const drop = DROP_CONSTRAINT_RE.exec(clause);
      if (drop) events.push({ at, drop: { child, constraint: drop[1]!.toLowerCase() } });
    }
  }
  for (const t of sql.matchAll(CREATE_TABLE_BODY_RE)) {
    const child = t[1]!.toLowerCase();
    for (const m of t[2]!.matchAll(INLINE_FK_RE)) {
      events.push({
        at: (t.index ?? 0) + (m.index ?? 0),
        add: {
          child,
          constraint: `${child}_${m[1]!.toLowerCase()}_fkey`,
          parent: toParent(m[2], m[3]!),
        },
      });
    }
  }
  events.sort((a, b) => a.at - b.at);
  const live: CascadeEdge[] = [];
  for (const e of events) {
    if (e.add) live.push(e.add);
    if (e.drop) {
      const i = live.findIndex(
        (x) => x.child === e.drop!.child && x.constraint === e.drop!.constraint,
      );
      if (i >= 0) live.splice(i, 1);
    }
  }
  return live;
}

export function auditCascadeReachability(
  sql: string,
  opts: { nonUser?: Set<string> } = {},
): RlsDrift[] {
  const nonUser = opts.nonUser ?? NON_USER_TABLES;
  const created = createdTables(sql);

  // child -> set of parents it cascade-deletes from, after every DROP.
  const parents = new Map<string, Set<string>>();
  for (const edge of collectCascadeEdges(sql)) {
    if (!parents.has(edge.child)) parents.set(edge.child, new Set());
    parents.get(edge.child)!.add(edge.parent);
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
// rather than against hand-written SQL only. Fails closed on an empty corpus:
// `auditCascadeReachability("")` is `[]`, so a test that only asserted the
// empty drift would stay green with zero tables (aped-review 11-2).
export function readAllMigrationSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = resolve(here, "..", "prisma", "migrations");
  const files = migrationSqlFiles(migrationsDir);
  if (files.length === 0) {
    throw new Error(`[rls-migration-audit] no migration.sql found under ${migrationsDir}`);
  }
  return files.map((f) => readFileSync(f, "utf8")).join("\n");
}

// Sorted: the corpus is replayed in order (a constraint added then dropped
// must end up absent) and readdirSync's order is filesystem-defined.
function migrationSqlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of [...readdirSync(dir)].sort()) {
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

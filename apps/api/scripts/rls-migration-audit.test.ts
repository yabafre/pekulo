import { describe, expect, it, test } from "bun:test";
import {
  auditCascadeReachability,
  auditMigrationSql,
  readAllMigrationSql,
} from "./rls-migration-audit";

// AC-1 (verbatim from story 11-3-rls-audit-and-encryption-doc:14):
//   Given a Prisma migration that creates a new public user-data table without
//   ENABLE ROW LEVEL SECURITY + policies, When the RLS audit runs (locally and
//   in CI), Then it exits non-zero and surfaces the offending table name.
//
// `auditMigrationSql` is the pure core (exported from the script so the gate is
// testable without the file-walk + process.exit). It returns one entry per
// drifted table; the names are what the CLI surfaces.
const driftedTables = (sql: string, opts?: Parameters<typeof auditMigrationSql>[1]): string[] =>
  auditMigrationSql(sql, opts).map((d) => d.table);

const CLEAN = `
  CREATE TABLE "widgets" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
  ALTER TABLE "widgets" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "sel" ON "widgets" FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "ins" ON "widgets" FOR INSERT WITH CHECK (auth.uid() = user_id);
`;
const FORGOT_RLS = `
  CREATE TABLE "leaky" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
`;

describe("rls-migration-audit (AC-1)", () => {
  test("clean migration set → no drift", () => {
    expect(driftedTables(CLEAN)).toEqual([]);
  });

  test("new table without RLS → flagged by name", () => {
    expect(driftedTables(FORGOT_RLS)).toEqual(["leaky"]);
  });

  test("RLS enabled but too few policies → flagged", () => {
    const oneOnly = `
      CREATE TABLE "x" ("user_id" UUID);
      ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "p" ON "x" FOR SELECT USING (auth.uid() = user_id);
    `;
    expect(driftedTables(oneOnly)).toEqual(["x"]);
  });

  test("non-user table allow-listed → skipped", () => {
    expect(driftedTables(FORGOT_RLS, { nonUser: new Set(["leaky"]) })).toEqual([]);
  });

  test("schema-qualified tables (vault/auth) are ignored", () => {
    const qualified = `CREATE TABLE "vault"."secrets" ("id" UUID);`;
    expect(driftedTables(qualified)).toEqual([]);
  });

  test("unquoted CREATE TABLE without RLS → still flagged by name", () => {
    // Hand-appended RLS migrations are free-form SQL; an unquoted name must not
    // slip past the gate (regression guard for the quotes-optional capture).
    expect(driftedTables(`CREATE TABLE leaky_unquoted ("user_id" UUID NOT NULL);`)).toEqual([
      "leaky_unquoted",
    ]);
  });
});

// AC-5 (verbatim from story 11-2-account-deletion:18):
//   Given the committed migration SQL, When `db:rls-migration-audit` runs,
//   Then it fails and names the table if any public user-data table cannot
//   reach `auth.users` through an `ON DELETE CASCADE` path — directly, or
//   through a parent table that can. A new user-data table without that path
//   is a build failure.
describe("auditCascadeReachability (story 11-2, AC-5)", () => {
  const CREATE_TWO = `
    CREATE TABLE "widgets" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
    CREATE TABLE "widget_logs" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL, "widget_id" TEXT NOT NULL);
  `;

  it("reports a user table with no path to auth.users", () => {
    const drift = auditCascadeReachability(CREATE_TWO);
    expect(drift.map((d) => d.table).sort()).toEqual(["widget_logs", "widgets"]);
  });

  it("accepts a direct FK to auth.users with ON DELETE CASCADE", () => {
    const sql = `${CREATE_TWO}
      ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
      ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_fk"
        FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;`;
    expect(auditCascadeReachability(sql)).toEqual([]);
  });

  it("accepts an INDIRECT path through a parent that cascades (account_balance_log shape)", () => {
    const sql = `${CREATE_TWO}
      ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
      ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_parent_fk"
        FOREIGN KEY ("widget_id") REFERENCES "widgets"("id") ON DELETE CASCADE;`;
    expect(auditCascadeReachability(sql)).toEqual([]);
  });

  it("rejects a parent FK that is NOT ON DELETE CASCADE", () => {
    const sql = `${CREATE_TWO}
      ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
      ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_parent_fk"
        FOREIGN KEY ("widget_id") REFERENCES "widgets"("id") ON DELETE SET NULL;`;
    expect(auditCascadeReachability(sql).map((d) => d.table)).toEqual(["widget_logs"]);
  });

  it("skips the declared non-user tables", () => {
    const sql = `CREATE TABLE "merchant_logo_cache" ("merchant_key" TEXT NOT NULL);`;
    expect(auditCascadeReachability(sql)).toEqual([]);
  });

  it("passes on the real committed migration corpus", () => {
    // The whole point of the gate: the four tables T1 fixed must now be
    // reachable, and every future table must stay reachable.
    expect(auditCascadeReachability(readAllMigrationSql())).toEqual([]);
  });
});

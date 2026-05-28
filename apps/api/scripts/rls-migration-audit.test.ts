import { describe, expect, test } from "bun:test";
import { auditMigrationSql } from "./rls-migration-audit";

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

// AC-1 (verbatim from story 11-6-restore-drill-and-glitchtip:16):
//   Given the latest production Supabase snapshot, When I restore it into
//   the staging Supabase project and run `bun --filter=@pekulo/api
//   db:restore-drill-check` against that restored database, Then the command
//   exits `0` after asserting: committed/applied migration parity, RLS
//   coverage on all 21 user-scoped tables, zero `NULL user_id` rows, a
//   non-empty `auth.users`, a successful Supabase Auth password round-trip,
//   and a `200` on `POST /rpc/v1/settings/get`. And the runnable procedure
//   plus a dated record (snapshot timestamp, RTO, anomalies, cleanup) is
//   appended to `docs/security.md`. And the story cannot move to `done`
//   before that record exists. (NFR-21)

import { describe, expect, test } from "bun:test";

import {
  evaluateAuthUsers,
  evaluateMigrationParity,
  evaluateNullUserIds,
  quoteIdentifier,
} from "./restore-drill-lib";

describe("evaluateNullUserIds", () => {
  test("returns nothing when every table is clean", () => {
    expect(
      evaluateNullUserIds([
        { table: "accounts", null_count: "0" },
        { table: "transactions", null_count: 0 },
      ]),
    ).toEqual([]);
  });

  test("names every table that still has orphan rows", () => {
    expect(
      evaluateNullUserIds([
        { table: "accounts", null_count: "2" },
        { table: "transactions", null_count: 0 },
      ]),
    ).toEqual(["accounts: 2 rows with NULL user_id"]);
  });
});

describe("evaluateMigrationParity", () => {
  test("passes on equal counts", () => {
    expect(evaluateMigrationParity(34, 34)).toEqual([]);
  });

  test("reports both counts on drift", () => {
    expect(evaluateMigrationParity(34, 33)).toEqual(["migrations: 34 committed, 33 applied"]);
  });
});

describe("evaluateAuthUsers", () => {
  test("passes when identities survived the restore", () => {
    expect(evaluateAuthUsers("3")).toEqual([]);
  });

  test("fails on an empty auth schema", () => {
    expect(evaluateAuthUsers(0)).toEqual([
      "auth.users is empty — the snapshot did not carry identities",
    ]);
  });
});

describe("quoteIdentifier", () => {
  test("quotes and escapes trusted table names", () => {
    expect(quoteIdentifier("accounts")).toBe('"accounts"');
    expect(quoteIdentifier('odd"name')).toBe('"odd""name"');
  });
});

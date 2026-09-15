// Story 11-2, AC-1 + AC-3. Behaviour of the local fan-out against a fake
// client: every node is issued, every call carries where.userId, the vault
// purge runs before bank_connections is deleted, and the counts come back
// keyed by table.
//
// Two tenants, always — a single-tenant fixture cannot prove isolation
// (lesson 2026-05-27). Here the fake enforces the filter, so a node that
// forgot `where: { userId }` deletes B's rows and the assertion catches it.
import { describe, expect, test } from "bun:test";
import { DELETION_NODES, deleteUserData, purgeVaultSecrets } from "./settings.deletion";
import type { ExtendedPrismaClient } from "../../database";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface Recorder {
  calls: string[];
  rawQueries: string[];
  rawParams: unknown[][];
  survivors: Map<string, string[]>;
}

// Each delegate owns two rows: one for A, one for B. deleteMany removes only
// the rows whose userId matches the filter, so an unfiltered node wipes both.
function fakeClient(
  recorder: Recorder,
  bankSecretIds: Array<[string | null, string | null]> = [],
): ExtendedPrismaClient {
  const delegate = (name: string) => ({
    deleteMany: async ({ where }: { where: { userId: string } }) => {
      recorder.calls.push(name);
      const owners = recorder.survivors.get(name) ?? [USER_A, USER_B];
      const kept = owners.filter((owner) => owner !== where.userId);
      recorder.survivors.set(name, kept);
      return { count: owners.length - kept.length };
    },
    findMany: async ({ where }: { where: { userId: string } }) => {
      recorder.calls.push(`${name}.findMany`);
      if (where.userId !== USER_A) return [];
      return bankSecretIds.map(([accessTokenSecretId, refreshTokenSecretId]) => ({
        accessTokenSecretId,
        refreshTokenSecretId,
      }));
    },
  });
  // The interactive-transaction callback must receive the PROXY, not the bare
  // root: production hands `tx` to every node, and a `tx` without delegates
  // would fail all 21 nodes for a reason unrelated to the behaviour under test.
  const root = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(proxy),
    $executeRaw: async (strings: TemplateStringsArray, ...params: unknown[]) => {
      recorder.rawQueries.push(strings.join("?"));
      recorder.rawParams.push(params);
      return (params[0] as string[]).length;
    },
  };
  const proxy = new Proxy(root, {
    get: (target, prop: string) =>
      prop in target ? (target as Record<string, unknown>)[prop] : delegate(prop),
  });
  return proxy as unknown as ExtendedPrismaClient;
}

function newRecorder(): Recorder {
  return { calls: [], rawQueries: [], rawParams: [], survivors: new Map() };
}

describe("deleteUserData (story 11-2)", () => {
  // AC-1 (verbatim from story 11-2-account-deletion:14):
  //   Given a signed-in user holding rows across the 21 user-scoped tables,
  //   When they confirm deletion […] Then every row they own is removed from
  //   all 21 tables […]
  test("AC-1 — issues one delete per node and returns a count per table", async () => {
    const recorder = newRecorder();
    const result = await deleteUserData(fakeClient(recorder), USER_A);

    expect(DELETION_NODES).toHaveLength(21);
    expect(Object.keys(result.rowsDeleted).sort()).toEqual(
      DELETION_NODES.map((node) => node.key).sort(),
    );
    for (const node of DELETION_NODES) {
      expect(result.rowsDeleted[node.key], `${node.key} reported no deletion`).toBe(1);
    }
  });

  test("AC-1 — deletes in DELETION_NODES order, children before parents", async () => {
    const recorder = newRecorder();
    await deleteUserData(fakeClient(recorder), USER_A);
    const deleteCalls = recorder.calls.filter((call) => !call.endsWith(".findMany"));
    expect(deleteCalls).toEqual([
      "holdingLot",
      "holding",
      "accountBalanceLog",
      "transaction",
      "account",
      "realEstateValuation",
      "realEstateMortgage",
      "realEstateRental",
      "realEstate",
      "kpi",
      "monthlyTracking",
      "monthlyRecord",
      "hypothesis",
      "compassHistory",
      "milestone",
      "bankConnection",
      "bridgeUser",
      "llmCallLog",
      "llmOptIn",
      "userPref",
      "dashboardLayout",
    ]);
  });

  // AC-3 (verbatim from story 11-2-account-deletion:16):
  //   Given two users A and B who each own rows in every user-scoped table,
  //   When A deletes their account, Then not one row belonging to B is
  //   removed, on any of the 21 tables […]
  test("AC-3 — user B keeps every row on every one of the 21 tables", async () => {
    const recorder = newRecorder();
    await deleteUserData(fakeClient(recorder), USER_A);
    // Every node must have run (otherwise `survivors` is silently empty and
    // the assertion below would pass by vacuity)…
    expect(recorder.survivors.size).toBe(DELETION_NODES.length);
    // …and every one of them must have left B's row standing.
    for (const [table, owners] of recorder.survivors) {
      expect(owners, `${table} lost user B's row`).toEqual([USER_B]);
    }
  });

  test("AC-1 — is idempotent: a second run reports zeroes, not an error", async () => {
    const recorder = newRecorder();
    const client = fakeClient(recorder);
    await deleteUserData(client, USER_A);
    const second = await deleteUserData(client, USER_A);
    for (const node of DELETION_NODES) {
      expect(second.rowsDeleted[node.key]).toBe(0);
    }
  });
});

describe("purgeVaultSecrets (story 11-2)", () => {
  test("is a no-op when every secret reference is NULL (the state today)", async () => {
    const recorder = newRecorder();
    const client = fakeClient(recorder, [[null, null]]);
    expect(await purgeVaultSecrets(client, USER_A)).toBe(0);
    expect(recorder.rawQueries).toEqual([]);
  });

  test("purges every distinct non-null secret id, parameterised", async () => {
    const recorder = newRecorder();
    const client = fakeClient(recorder, [
      ["sec-1", "sec-2"],
      ["sec-1", null],
    ]);
    expect(await purgeVaultSecrets(client, USER_A)).toBe(2);
    expect(recorder.rawQueries).toHaveLength(1);
    expect(recorder.rawQueries[0]).toContain("DELETE FROM vault.secrets");
    // Parameterised, never interpolated: the ids arrive as a bound param.
    expect(recorder.rawParams[0]).toEqual([["sec-1", "sec-2"]]);
  });

  test("runs BEFORE bank_connections is deleted", async () => {
    const recorder = newRecorder();
    await deleteUserData(fakeClient(recorder, [["sec-1", null]]), USER_A);
    const readIndex = recorder.calls.indexOf("bankConnection.findMany");
    const deleteIndex = recorder.calls.indexOf("bankConnection");
    expect(readIndex).toBeGreaterThanOrEqual(0);
    expect(readIndex).toBeLessThan(deleteIndex);
  });
});

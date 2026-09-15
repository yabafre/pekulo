// apps/api/src/modules/settings/settings.deletion.ts
// Story 11-2 (FR-50 / NFR-7 / DR-5). GDPR right to erasure — the local half.
//
// DELETION_NODES is the ordered mirror of EXPORT_NODES (settings.export.ts):
// the same model set, asserted equal by settings.deletion-map.guard.test.ts,
// in child-before-parent order.
//
// WHY EXPLICIT DELETES AND NOT THE auth.users CASCADE ALONE.
// Four of the 21 user-scoped tables shipped with NO foreign key to auth.users
// on any path — compass_history, milestones, user_pref and dashboard_layout —
// while three of their migrations carried a comment asserting the opposite
// ("row removal happens only via cascade from auth.users (story 11-2)"). An
// erasure built on "the cascade handles it" silently left four tables of
// personal data behind, and every test in the repo passed.
// Migration 20260915120000_add_missing_auth_users_fk closes that hole and the
// gate in scripts/rls-migration-audit.ts keeps it closed, but this explicit
// fan-out stays: it is what makes the erasure deterministic, countable, and
// survivable when the next table forgets its FK.
//
// The whole fan-out runs in ONE interactive transaction, so a failure halfway
// through leaves the account intact rather than half-erased.
import type { ExtendedPrismaClient } from "../../database";

export interface DeletionNode {
  /** Key in the returned count map. snake_case, matches the table name. */
  readonly key: string;
  /** Prisma model name — must match a DMMF model (asserted by the guard test). */
  readonly model: string;
  /** Deletes every row this user owns. Always carries an explicit where: { userId }. */
  remove(client: ExtendedPrismaClient, userId: string): Promise<{ count: number }>;
}

// Child-before-parent. Deleting a parent first would cascade its children and
// leave their counts reporting 0, which is exactly the evidence AC-1 needs.
export const DELETION_NODES: readonly DeletionNode[] = [
  // --- accounts aggregate: leaves first, root last ---
  {
    key: "holding_lots",
    model: "HoldingLot",
    remove: (client, userId) => client.holdingLot.deleteMany({ where: { userId } }),
  },
  {
    key: "holdings",
    model: "Holding",
    remove: (client, userId) => client.holding.deleteMany({ where: { userId } }),
  },
  {
    key: "account_balance_log",
    model: "AccountBalanceLog",
    remove: (client, userId) => client.accountBalanceLog.deleteMany({ where: { userId } }),
  },
  {
    key: "transactions",
    model: "Transaction",
    remove: (client, userId) => client.transaction.deleteMany({ where: { userId } }),
  },
  {
    key: "accounts",
    model: "Account",
    remove: (client, userId) => client.account.deleteMany({ where: { userId } }),
  },
  // --- real-estate aggregate: children first, root last ---
  {
    key: "real_estate_valuations",
    model: "RealEstateValuation",
    remove: (client, userId) => client.realEstateValuation.deleteMany({ where: { userId } }),
  },
  {
    key: "real_estate_mortgage",
    model: "RealEstateMortgage",
    remove: (client, userId) => client.realEstateMortgage.deleteMany({ where: { userId } }),
  },
  {
    key: "real_estate_rental",
    model: "RealEstateRental",
    remove: (client, userId) => client.realEstateRental.deleteMany({ where: { userId } }),
  },
  {
    key: "real_estate",
    model: "RealEstate",
    remove: (client, userId) => client.realEstate.deleteMany({ where: { userId } }),
  },
  // --- independent tables: no intra-set FK, order is free ---
  {
    key: "kpis",
    model: "Kpi",
    remove: (client, userId) => client.kpi.deleteMany({ where: { userId } }),
  },
  {
    key: "monthly_tracking",
    model: "MonthlyTracking",
    remove: (client, userId) => client.monthlyTracking.deleteMany({ where: { userId } }),
  },
  {
    key: "monthly_records",
    model: "MonthlyRecord",
    remove: (client, userId) => client.monthlyRecord.deleteMany({ where: { userId } }),
  },
  {
    key: "hypotheses",
    model: "Hypothesis",
    remove: (client, userId) => client.hypothesis.deleteMany({ where: { userId } }),
  },
  {
    key: "compass_history",
    model: "CompassHistory",
    remove: (client, userId) => client.compassHistory.deleteMany({ where: { userId } }),
  },
  {
    key: "milestones",
    model: "Milestone",
    remove: (client, userId) => client.milestone.deleteMany({ where: { userId } }),
  },
  {
    key: "bank_connections",
    model: "BankConnection",
    remove: (client, userId) => client.bankConnection.deleteMany({ where: { userId } }),
  },
  {
    key: "bridge_users",
    model: "BridgeUser",
    remove: (client, userId) => client.bridgeUser.deleteMany({ where: { userId } }),
  },
  {
    key: "llm_call_log",
    model: "LlmCallLog",
    remove: (client, userId) => client.llmCallLog.deleteMany({ where: { userId } }),
  },
  {
    key: "llm_opt_in",
    model: "LlmOptIn",
    remove: (client, userId) => client.llmOptIn.deleteMany({ where: { userId } }),
  },
  {
    key: "user_pref",
    model: "UserPref",
    remove: (client, userId) => client.userPref.deleteMany({ where: { userId } }),
  },
  {
    key: "dashboard_layout",
    model: "DashboardLayout",
    remove: (client, userId) => client.dashboardLayout.deleteMany({ where: { userId } }),
  },
];

/**
 * Purges the Supabase Vault secrets referenced by this user's bank
 * connections, BEFORE the connections themselves are deleted.
 *
 * Today these columns are vestigial NULL: Bridge v3 keeps OAuth tokens
 * server-side and mints a short-lived Bearer on demand, so Pekulo persists no
 * bank tokens (ADR-0015, docs/security.md). The FK is ON DELETE SET NULL, so
 * if the columns are ever written, deleting the connection would NULL the
 * reference and leave the vault row behind — a decrypted-on-demand credential
 * outliving the account that owned it. Ten lines now, rather than a comment
 * that ages into a leak.
 *
 * This is the ONE place apps/api runs raw SQL against something other than the
 * `SELECT 1` health probe. `vault.secrets` is outside Prisma's schema, so
 * there is no delegate to call; the query is parameterised (never
 * interpolated) and compares on `id::text` so the driver can pass a plain
 * text[] with no cast on the parameter side. Recorded in docs/security.md.
 */
export async function purgeVaultSecrets(
  client: ExtendedPrismaClient,
  userId: string,
): Promise<number> {
  const rows = await client.bankConnection.findMany({
    where: { userId },
    select: { accessTokenSecretId: true, refreshTokenSecretId: true },
  });
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [row.accessTokenSecretId, row.refreshTokenSecretId])
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (ids.length === 0) return 0;
  return client.$executeRaw`DELETE FROM vault.secrets WHERE id::text = ANY(${ids})`;
}

export interface LocalErasureResult {
  rowsDeleted: Record<string, number>;
  vaultSecretsPurged: number;
}

// Prisma's default interactive-transaction timeout is 5 s. NFR-7 budgets 60 s
// for the whole deletion, of which the provider call and the identity erase
// take their own share — 45 s leaves room for both while still failing well
// inside the budget rather than hanging.
const DELETION_TX_TIMEOUT_MS = 45_000;
const DELETION_TX_MAX_WAIT_MS = 5_000;

/**
 * Deletes every row the user owns, in one transaction, and returns the row
 * count per table. Idempotent: a re-run on an already-erased user returns a
 * map of zeroes rather than failing.
 */
export async function deleteUserData(
  client: ExtendedPrismaClient,
  userId: string,
): Promise<LocalErasureResult> {
  return client.$transaction(
    async (tx) => {
      // The interactive-transaction client is structurally the delegate
      // surface DELETION_NODES uses, but Prisma types it as a distinct type
      // (it drops $transaction / $connect / $disconnect). One documented cast
      // at the boundary beats threading a hand-written client type through 21
      // node definitions. Named `tx` so
      // pekulo/no-prisma-query-without-user-id still inspects every call
      // inside the nodes (.oxlintrc.json prismaIdentifier: ["prisma","tx","client"]).
      const txClient = tx as unknown as ExtendedPrismaClient;

      const vaultSecretsPurged = await purgeVaultSecrets(txClient, userId);

      const rowsDeleted: Record<string, number> = {};
      for (const node of DELETION_NODES) {
        // Sequential ON PURPOSE: the order is what keeps every count truthful
        // (a parent deleted first would cascade its children to 0) and what
        // keeps FK constraints satisfied without relying on cascade order.
        // Promise.all would discard both guarantees.
        // oxlint-disable-next-line eslint/no-await-in-loop
        const { count } = await node.remove(txClient, userId);
        rowsDeleted[node.key] = count;
      }
      return { rowsDeleted, vaultSecretsPurged };
    },
    { timeout: DELETION_TX_TIMEOUT_MS, maxWait: DELETION_TX_MAX_WAIT_MS },
  );
}

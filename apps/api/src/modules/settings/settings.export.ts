// apps/api/src/modules/settings/settings.export.ts
// Story 11-1 (FR-49 / NFR-6 / NFR-30 / DR-5). GDPR portability export.
//
// Streams one JSON chunk per table so peak memory tracks the LARGEST table
// rather than the whole payload — that is what makes NFR-30's 100 MB ceiling
// and AC-1's "download STARTS within 60 s" (time-to-first-byte) meaningful.
//
// EXPORT_NODES is the single source of truth for "what is my data".
// settings.export-map.guard.test.ts fails the build when a Prisma model
// carrying a `userId` field is missing from it — the same DMMF technique
// database/id-prefixes.config.test.ts uses to close the 2026-06-05 lesson
// class for the prefix registry.
//
// Do NOT rebuild this list from scripts/rls-audit.ts: its
// EXPECTED_POLICY_COUNTS holds 20 entries for 21 user-scoped tables
// (dashboard_layout is absent), so it is not a complete table inventory.
import type { ExtendedPrismaClient } from "../../database";
import { decimalToNumber } from "../../common/derive/decimal-to-number";
import { EXPORT_NODE_SCHEMA_VERSION, EXPORT_SCHEMA_VERSION } from "@pekulo/validators";

// Vault secret references on BankConnection — never exported (AC-4).
export const BANK_CONNECTION_SECRET_FIELDS = [
  "accessTokenSecretId",
  "refreshTokenSecretId",
] as const;

// Explicit allowlist rather than `omit`: fail-closed on secrets. The guard
// test asserts this set equals "every BankConnection scalar field minus the
// two secret columns", so a new column is a build failure — either it joins
// this list, or it joins BANK_CONNECTION_SECRET_FIELDS. Never silence it.
export const bankConnectionExportSelect = {
  id: true,
  userId: true,
  provider: true,
  providerItemId: true,
  status: true,
  displayName: true,
  providerId: true,
  lastRefreshedAt: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ExportNode {
  /** Top-level key in the exported document. snake_case, matches the table name. */
  readonly key: string;
  /** Prisma model name — must match a DMMF model (asserted by the guard test). */
  readonly model: string;
  /** Every row this user owns. Always carries an explicit where: { userId }. */
  read(client: ExtendedPrismaClient, userId: string): Promise<unknown[]>;
}

// Ordering is intentionally NOT specified: a portability dump has no natural
// order, and inventing an orderBy field per model would be 21 guesses about
// columns this story has not verified. Postgres order is stable enough for
// the purpose and no acceptance criterion depends on it.
export const EXPORT_NODES: readonly ExportNode[] = [
  {
    key: "accounts",
    model: "Account",
    read: (client, userId) => client.account.findMany({ where: { userId } }),
  },
  {
    key: "account_balance_log",
    model: "AccountBalanceLog",
    read: (client, userId) => client.accountBalanceLog.findMany({ where: { userId } }),
  },
  {
    key: "holdings",
    model: "Holding",
    read: (client, userId) => client.holding.findMany({ where: { userId } }),
  },
  {
    key: "holding_lots",
    model: "HoldingLot",
    read: (client, userId) => client.holdingLot.findMany({ where: { userId } }),
  },
  {
    key: "transactions",
    model: "Transaction",
    read: (client, userId) => client.transaction.findMany({ where: { userId } }),
  },
  {
    key: "kpis",
    model: "Kpi",
    read: (client, userId) => client.kpi.findMany({ where: { userId } }),
  },
  {
    key: "monthly_tracking",
    model: "MonthlyTracking",
    read: (client, userId) => client.monthlyTracking.findMany({ where: { userId } }),
  },
  {
    key: "monthly_records",
    model: "MonthlyRecord",
    read: (client, userId) => client.monthlyRecord.findMany({ where: { userId } }),
  },
  {
    key: "hypotheses",
    model: "Hypothesis",
    read: (client, userId) => client.hypothesis.findMany({ where: { userId } }),
  },
  {
    key: "compass_history",
    model: "CompassHistory",
    read: (client, userId) => client.compassHistory.findMany({ where: { userId } }),
  },
  {
    key: "milestones",
    model: "Milestone",
    read: (client, userId) => client.milestone.findMany({ where: { userId } }),
  },
  {
    key: "real_estate",
    model: "RealEstate",
    read: (client, userId) => client.realEstate.findMany({ where: { userId } }),
  },
  {
    key: "real_estate_mortgage",
    model: "RealEstateMortgage",
    read: (client, userId) => client.realEstateMortgage.findMany({ where: { userId } }),
  },
  {
    key: "real_estate_rental",
    model: "RealEstateRental",
    read: (client, userId) => client.realEstateRental.findMany({ where: { userId } }),
  },
  {
    key: "real_estate_valuations",
    model: "RealEstateValuation",
    read: (client, userId) => client.realEstateValuation.findMany({ where: { userId } }),
  },
  {
    key: "bank_connections",
    model: "BankConnection",
    read: (client, userId) =>
      client.bankConnection.findMany({ where: { userId }, select: bankConnectionExportSelect }),
  },
  {
    key: "bridge_users",
    model: "BridgeUser",
    read: (client, userId) => client.bridgeUser.findMany({ where: { userId } }),
  },
  {
    key: "llm_call_log",
    model: "LlmCallLog",
    read: (client, userId) => client.llmCallLog.findMany({ where: { userId } }),
  },
  {
    key: "llm_opt_in",
    model: "LlmOptIn",
    read: (client, userId) => client.llmOptIn.findMany({ where: { userId } }),
  },
  {
    key: "user_pref",
    model: "UserPref",
    read: (client, userId) => client.userPref.findMany({ where: { userId } }),
  },
  {
    key: "dashboard_layout",
    model: "DashboardLayout",
    read: (client, userId) => client.dashboardLayout.findMany({ where: { userId } }),
  },
];

// Prisma returns Decimal columns as decimal.js instances, which JSON.stringify
// would serialise as an object of internal fields. Route them through the
// repo's decimalToNumber helper (lesson L24 — inlining Number(decimal) or
// duplicating the helper is a review fail).
function exportJsonReplacer(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return decimalToNumber(value, 0);
  }
  return value;
}

export interface ExportIdentityInput {
  userId: string;
  email: string | null;
}

/**
 * Yields the export document as a sequence of JSON fragments:
 * header (with identity), then exactly one fragment per EXPORT_NODES entry,
 * then the closing brace. Concatenating every yielded string produces a
 * document valid against docs/exports/schema-v1.json.
 */
export async function* streamUserDataExport(
  client: ExtendedPrismaClient,
  identity: ExportIdentityInput,
  now: Date = new Date(),
): AsyncGenerator<string> {
  yield (
    `{"schema_version":${JSON.stringify(EXPORT_SCHEMA_VERSION)},` +
      `"generated_at":${JSON.stringify(now.toISOString())},` +
      `"identity":{"schema_version":${JSON.stringify(EXPORT_NODE_SCHEMA_VERSION)},` +
      `"user_id":${JSON.stringify(identity.userId)},` +
      `"email":${JSON.stringify(identity.email)}}`
  );

  for (const node of EXPORT_NODES) {
    const rows = await node.read(client, identity.userId);
    yield (
      `,${JSON.stringify(node.key)}:` +
        `{"schema_version":${JSON.stringify(EXPORT_NODE_SCHEMA_VERSION)},` +
        `"rows":${JSON.stringify(rows, exportJsonReplacer)}}`
    );
  }

  yield "}";
}

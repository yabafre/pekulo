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
//
// KNOWN LIMIT — no snapshot. The 21 reads are sequential and share no
// transaction or isolation level, so a write landing between node 1 and node
// 21 can produce a document where, say, a transaction references an account
// that is not in the accounts node. Accepted for a portability dump, where the
// user is the only writer and the file has no referential contract; wrapping
// the fan-out in $transaction({ isolationLevel: "RepeatableRead" }) would fix
// it at the cost of holding one snapshot open for the whole export.
// (aped-review, story 11-1.)
import type { ExtendedPrismaClient } from "../../database";
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

// Decimal columns are exported as JSON STRINGS, deliberately.
//
// A JSON.stringify replacer cannot change this: ECMA-262 SerializeJSONProperty
// calls the value's own `toJSON()` BEFORE handing it to the replacer, and
// Prisma's Decimal (decimal.js) defines `toJSON`. A replacer therefore only
// ever receives the already-serialised string — the story's original
// `exportJsonReplacer` (routed through decimalToNumber, lesson L24) was dead
// code on every real row, and its unit test passed only because the fake
// Decimal lacked `toJSON`. Found in aped-review of story 11-1.
//
// Keeping the string is the better outcome for a portability artefact: it is
// the exact decimal the database holds, with no float rounding. Documented in
// docs/exports/schema-v1.json. Do NOT re-add a replacer here — it cannot work;
// forcing numbers would require mapping rows against the DMMF before
// stringifying, and would trade exactness for a float.

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
      `"email":${JSON.stringify(identity.email ?? null)}}`
  );

  for (const node of EXPORT_NODES) {
    // `?? []` so a node whose read resolves undefined yields `"rows":[]`
    // rather than the bare token `undefined`, which would silently produce a
    // file that is not JSON at all.
    //
    // Sequential ON PURPOSE (AC-8): one table in flight at a time is what keeps
    // peak memory tracking the largest single table instead of the whole
    // export. The rule's suggested Promise.all would load all 21 tables at once
    // and defeat the entire streaming design — suppressed rather than left as
    // standing noise in the lint output.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const rows = (await node.read(client, identity.userId)) ?? [];
    yield (
      `,${JSON.stringify(node.key)}:` +
        `{"schema_version":${JSON.stringify(EXPORT_NODE_SCHEMA_VERSION)},` +
        `"rows":${JSON.stringify(rows)}}`
    );
  }

  yield "}";
}

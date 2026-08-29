# Story: 11-1-data-export — GDPR data export: every user-scoped table streamed as one JSON file conforming to schema-v1

**Epic:** Epic 11 — Public-ramp readiness
**Status:** review
**Ticket:** #48
**Branch:** feature/48-11-1-data-export

## User Story

**As a** Pekulo user, **I want** to export all of my data as a single JSON file from the settings page, **so that** I can exercise my GDPR right to data portability.

## Acceptance Criteria

- **AC-1** — **Given** a signed-in user holding rows across the 21 user-scoped tables, **When** they activate « Exporter mes données » in Paramètres → Vos données, **Then** the browser download starts in under 60 s and the downloaded file validates against `docs/exports/schema-v1.json`. (FR-49, NFR-6, NFR-30, DR-5)
- **AC-2** — **Given** the downloaded payload, **When** it is parsed, **Then** the document root carries a `schema_version` field **and** every top-level node (`identity` plus each table node) carries its own `schema_version`. (NFR-30 requires the root; ticket #48 AC-2 requires each node — both hold.)
- **AC-3** — **Given** two users A and B who each own rows in every user-scoped table, **When** A exports, **Then** no row belonging to B appears anywhere in A's payload, for **every one** of the 21 nodes. (Per the 2026-05-27 lesson: a single-tenant fixture cannot prove isolation — the test seeds two users and asserts on both.)
- **AC-4** — **Given** a user holding a Bridge `bank_connection`, **When** they export, **Then** the payload carries the connection metadata (provider, providerItemId, status, displayName, providerId, timestamps) and carries **neither** `accessTokenSecretId` **nor** `refreshTokenSecretId` (Supabase Vault references). (NFR-31, ADR-0015)
- **AC-5** — **Given** a database table that holds user data but was never added to the export, **When** the apps/api test suite runs, **Then** it fails and names that table. **Given** a new column on the bank-connection table, **When** the suite runs, **Then** it fails until that column has been explicitly classified as either exportable user data or a secret — a new column can never reach the export, or be dropped from it, unnoticed.
- **AC-6** — **Given** a request to `GET /v1/export` on apps/api with no `Authorization` header, or with an invalid Bearer token, **Then** apps/api answers `401` and no Prisma query runs. **Given** an unauthenticated browser request to the apps/web `/v1/export` proxy, **Then** the proxy answers `401` without ever calling apps/api.
- **AC-7** — **Given** the Paramètres page, **When** it renders, **Then** a « Vos données » section appears after the « Intelligence artificielle » section and before the compass settings, holding one row labelled « Exporter mes données » with the sub-label « JSON complet · conforme RGPD » and a download control — in both `fr` and `en`. **When** that section is scanned for accessibility, **Then** it reports zero violations and the download control exposes an accessible name.
- **AC-8** — **Given** a user whose data spans every table, **When** the export response is produced, **Then** the server emits it incrementally — a header fragment, then exactly one fragment per table, then a closing fragment — so peak memory tracks the largest single table rather than the total payload.

## Tasks

- [x] **T1 — Publish the export JSON Schema** [AC: AC-1, AC-2]

  Create `docs/exports/schema-v1.json` with the exact content below. This is the artefact NFR-30 names (“a published schema versioned in `docs/exports/schema-v1.json`”). `additionalProperties: true` on the node object is deliberate: a future table adds a node and must not invalidate previously exported files.

  ```json
  {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://pekulo.app/exports/schema-v1.json",
    "title": "Pekulo user data export",
    "description": "GDPR portability export (FR-49). One file per user, produced by GET /v1/export. Every top-level node carries its own schema_version so a node can evolve independently of the document.",
    "type": "object",
    "required": ["schema_version", "generated_at", "identity"],
    "properties": {
      "schema_version": {
        "type": "string",
        "const": "1.0.0",
        "description": "Version of this document envelope."
      },
      "generated_at": {
        "type": "string",
        "format": "date-time",
        "description": "ISO 8601 timestamp at which the export started streaming."
      },
      "identity": {
        "type": "object",
        "required": ["schema_version", "user_id", "email"],
        "properties": {
          "schema_version": { "type": "string" },
          "user_id": { "type": "string", "format": "uuid" },
          "email": { "type": ["string", "null"] }
        },
        "additionalProperties": false,
        "description": "Identity held by Supabase Auth rather than Postgres. The password hash is never exported."
      }
    },
    "patternProperties": {
      "^(?!schema_version$|generated_at$|identity$)[a-z_]+$": {
        "type": "object",
        "required": ["schema_version", "rows"],
        "properties": {
          "schema_version": { "type": "string" },
          "rows": { "type": "array", "items": { "type": "object" } }
        },
        "additionalProperties": false,
        "description": "One node per user-scoped table. `rows` holds every row the exporting user owns."
      }
    },
    "additionalProperties": true
  }
  ```

  Run: `bunx ajv-cli compile -s docs/exports/schema-v1.json --spec=draft2020`
  Expected: `schema docs/exports/schema-v1.json is valid`, exit 0.
  Commit: `git add docs/exports/schema-v1.json && git commit -m "feat(#48): publish export schema-v1 (NFR-30)"`

- [x] **T2 — Zod mirror of the export envelope** [AC: AC-2]

  Create `packages/validators/src/settings/export.schemas.ts` with the exact content below. It mirrors the published JSON Schema so apps/api and the tests share one definition of the envelope. Value lists are centralised per the 2026-05-09 project invariant (never inline the literals).

  ```ts
  // Zod source of truth for the GDPR export envelope (story 11-1, FR-49).
  // Mirrors docs/exports/schema-v1.json — the published artefact NFR-30 names.
  // The per-node `rows` array stays `z.record`-loose on purpose: the export is a
  // faithful row dump, and pinning 21 row shapes here would duplicate the Prisma
  // schema and rot on the first migration. Structure is validated; row contents
  // are the database's business.
  import { z } from "@pekulo/zod";

  // Envelope version — bumped only when the DOCUMENT shape changes.
  export const EXPORT_SCHEMA_VERSION = "1.0.0";
  // Node version — bumped when a NODE's shape changes, independently of the document.
  export const EXPORT_NODE_SCHEMA_VERSION = "1";

  export const exportIdentitySchema = z.object({
    schema_version: z.string(),
    user_id: z.string().uuid(),
    email: z.string().nullable(),
  });
  export type ExportIdentity = z.infer<typeof exportIdentitySchema>;

  export const exportNodeSchema = z.object({
    schema_version: z.string(),
    rows: z.array(z.record(z.string(), z.unknown())),
  });
  export type ExportNodePayload = z.infer<typeof exportNodeSchema>;

  export const userDataExportSchema = z
    .object({
      schema_version: z.literal(EXPORT_SCHEMA_VERSION),
      generated_at: z.string(),
      identity: exportIdentitySchema,
    })
    .catchall(exportNodeSchema);
  export type UserDataExport = z.infer<typeof userDataExportSchema>;
  ```

  Then replace the whole content of `packages/validators/src/settings/index.ts` with:

  ```ts
  export * from "./settings.schemas";
  export * from "./export.schemas";
  ```

  Run: `cd packages/validators && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add packages/validators/src/settings/export.schemas.ts packages/validators/src/settings/index.ts && git commit -m "feat(#48): zod mirror of the export envelope"`

- [x] **T3 — Export node map + streaming generator** [AC: AC-1, AC-2, AC-4, AC-8]

  Create `apps/api/src/modules/settings/settings.export.ts` with the exact content below.

  Two things carry the story's weight here and must not be "simplified" away:
  1. `EXPORT_NODES` is the single source of truth for “what is my data”. It is **not** derived from `apps/api/scripts/rls-audit.ts` — that script's `EXPECTED_POLICY_COUNTS` holds 20 entries for 21 user-scoped tables (`dashboard_layout` is missing from it), so deriving from it would silently drop a table.
  2. `BankConnection` is read through an explicit `select` allowlist, never a bare `findMany`, because two of its columns are Supabase Vault secret references (AC-4).

  ```ts
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
  import {
    EXPORT_NODE_SCHEMA_VERSION,
    EXPORT_SCHEMA_VERSION,
  } from "@pekulo/validators";

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
    yield `{"schema_version":${JSON.stringify(EXPORT_SCHEMA_VERSION)},` +
      `"generated_at":${JSON.stringify(now.toISOString())},` +
      `"identity":{"schema_version":${JSON.stringify(EXPORT_NODE_SCHEMA_VERSION)},` +
      `"user_id":${JSON.stringify(identity.userId)},` +
      `"email":${JSON.stringify(identity.email)}}`;

    for (const node of EXPORT_NODES) {
      const rows = await node.read(client, identity.userId);
      yield `,${JSON.stringify(node.key)}:` +
        `{"schema_version":${JSON.stringify(EXPORT_NODE_SCHEMA_VERSION)},` +
        `"rows":${JSON.stringify(rows, exportJsonReplacer)}}`;
    }

    yield "}";
  }
  ```

  Run: `cd apps/api && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.export.ts && git commit -m "feat(#48): export node map + streaming generator (FR-49)"`

- [x] **T4 — Drift guard: Prisma DMMF vs the export map** [AC: AC-5]

  Create `apps/api/src/modules/settings/settings.export-map.guard.test.ts` with the exact content below. This is the task that stops the story rotting: without it, table #22 escapes the export silently, exactly as `dashboard_layout` escaped `rls-audit.ts`.

  ```ts
  // Story 11-1, AC-5. The 2026-06-05 lesson in miniature: every place that
  // ENUMERATES the model set drifts the moment a migration lands. The prefix
  // registry closed that class with a DMMF meta-test
  // (database/id-prefixes.config.test.ts) — this is the same guard for the
  // export map, plus the reverse guard on the BankConnection select allowlist.
  import { describe, expect, it } from "bun:test";
  import { Prisma } from "@generated/prisma/client";
  import {
    BANK_CONNECTION_SECRET_FIELDS,
    EXPORT_NODES,
    bankConnectionExportSelect,
  } from "./settings.export";

  function modelsWithUserId(): string[] {
    return Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === "userId"))
      .map((model) => model.name);
  }

  describe("settings export map (story 11-1)", () => {
    it("covers every Prisma model that carries a userId field", () => {
      const registered = new Set(EXPORT_NODES.map((node) => node.model));
      const missing = modelsWithUserId().filter((name) => !registered.has(name));
      expect(
        missing,
        `Prisma model(s) hold user data but are absent from EXPORT_NODES in ` +
          `apps/api/src/modules/settings/settings.export.ts — a GDPR export that ` +
          `omits them is incomplete (FR-49). Add a node, or justify the omission ` +
          `in the story: ${missing.join(", ")}`,
      ).toEqual([]);
    });

    it("registers no model that Prisma does not know", () => {
      const known = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
      const unknown = EXPORT_NODES.map((node) => node.model).filter((name) => !known.has(name));
      expect(unknown, `EXPORT_NODES references unknown model(s): ${unknown.join(", ")}`).toEqual([]);
    });

    it("uses a unique top-level key per node", () => {
      const keys = EXPORT_NODES.map((node) => node.key);
      expect(new Set(keys).size, "duplicate key in EXPORT_NODES").toBe(keys.length);
    });

    it("selects every BankConnection field except the vault secret references", () => {
      const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "BankConnection");
      expect(model, "BankConnection missing from the Prisma DMMF").toBeDefined();
      const scalarFields = model!.fields
        .filter((field) => field.kind === "scalar")
        .map((field) => field.name);
      const secrets = new Set<string>(BANK_CONNECTION_SECRET_FIELDS);
      const expected = scalarFields.filter((name) => !secrets.has(name)).sort();
      const selected = Object.keys(bankConnectionExportSelect).sort();
      expect(
        selected,
        `bankConnectionExportSelect drifted from the BankConnection schema. Every ` +
          `new column must either join the select (it is user data and belongs in ` +
          `the export) or join BANK_CONNECTION_SECRET_FIELDS (it is a secret). ` +
          `Never silence this test.`,
      ).toEqual(expected);
    });

    it("never selects a vault secret reference", () => {
      for (const secret of BANK_CONNECTION_SECRET_FIELDS) {
        expect(
          Object.keys(bankConnectionExportSelect),
          `${secret} must never be exported (AC-4)`,
        ).not.toContain(secret);
      }
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.export-map.guard.test.ts`
  Expected: `5 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.export-map.guard.test.ts && git commit -m "test(#48): DMMF drift guard over the export map (AC-5)"`

- [x] **T5 — Unit tests for the generator** [AC: AC-2, AC-4, AC-8]

  Create `apps/api/src/modules/settings/settings.export.test.ts` with the exact content below. The fake client returns one row per node so the chunk count and the envelope shape are both asserted without a database.

  ```ts
  // Story 11-1 — generator-level proof: envelope shape (AC-2), one chunk per
  // node (AC-8), Decimal coercion, and no vault secret in the payload (AC-4).
  import { describe, expect, it } from "bun:test";
  import type { ExtendedPrismaClient } from "../../database";
  import { EXPORT_NODES, streamUserDataExport } from "./settings.export";
  import { userDataExportSchema } from "@pekulo/validators";

  const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const GENERATED_AT = new Date("2026-08-29T10:00:00.000Z");

  // Minimal decimal.js stand-in: the generator's replacer duck-types on
  // `toNumber`, exactly as decimalToNumber does.
  function fakeDecimal(value: number): { toNumber(): number } {
    return { toNumber: () => value };
  }

  // Answers `client.<anyModel>.findMany({ where: { userId } })` for every
  // delegate the node map reaches for, so the generator can run without a
  // database. Each row is tagged with the delegate name so the assertions can
  // tell nodes apart. `cashBalance` exercises the Decimal replacer.
  function fakeClient(): ExtendedPrismaClient {
    return new Proxy(
      {},
      {
        get: (_target, model: string) => ({
          findMany: async ({ where }: { where: { userId: string } }) => [
            { id: `${model}-1`, userId: where.userId, cashBalance: fakeDecimal(1234.56) },
          ],
        }),
      },
    ) as unknown as ExtendedPrismaClient;
  }

  async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
    const chunks: string[] = [];
    for await (const chunk of gen) chunks.push(chunk);
    return chunks;
  }

  async function exportDocument(): Promise<{ chunks: string[]; raw: string }> {
    const chunks = await collect(
      streamUserDataExport(fakeClient(), { userId: USER_A, email: "a@pekulo.local" }, GENERATED_AT),
    );
    return { chunks, raw: chunks.join("") };
  }

  describe("streamUserDataExport (story 11-1)", () => {
    it("yields the header, one chunk per node, and the closing brace", async () => {
      const { chunks } = await exportDocument();
      expect(chunks).toHaveLength(EXPORT_NODES.length + 2);
      expect(chunks[0]).toContain(`"schema_version":"1.0.0"`);
      expect(chunks[chunks.length - 1]).toBe("}");
    });

    it("produces a document that validates against the published envelope", async () => {
      const { raw } = await exportDocument();
      const result = userDataExportSchema.safeParse(JSON.parse(raw));
      expect(result.success, JSON.stringify(result.error?.issues ?? [], null, 2)).toBe(true);
    });

    it("carries schema_version on the root and on every top-level node", async () => {
      const { raw } = await exportDocument();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      expect(parsed.schema_version).toBe("1.0.0");
      expect(parsed.generated_at).toBe("2026-08-29T10:00:00.000Z");
      for (const [key, value] of Object.entries(parsed)) {
        if (key === "schema_version" || key === "generated_at") continue;
        expect((value as { schema_version?: string }).schema_version, `node ${key}`).toBe("1");
      }
    });

    it("emits one node per EXPORT_NODES entry, each holding the caller's rows", async () => {
      const { raw } = await exportDocument();
      const parsed = JSON.parse(raw) as Record<string, { rows: { userId: string }[] }>;
      for (const node of EXPORT_NODES) {
        expect(parsed[node.key], `node ${node.key} missing`).toBeDefined();
        expect(parsed[node.key].rows).toHaveLength(1);
        expect(parsed[node.key].rows[0].userId).toBe(USER_A);
      }
    });

    it("serialises a Decimal column as a JSON number, not an object", async () => {
      const { raw } = await exportDocument();
      const parsed = JSON.parse(raw) as Record<string, { rows: { cashBalance: unknown }[] }>;
      expect(parsed.accounts.rows[0].cashBalance).toBe(1234.56);
      expect(raw).not.toContain(`"cashBalance":{`);
    });

    it("exposes a bank_connections node and no vault secret key anywhere", async () => {
      const { raw } = await exportDocument();
      expect(raw).toContain(`"bank_connections"`);
      expect(raw).not.toContain("accessTokenSecretId");
      expect(raw).not.toContain("refreshTokenSecretId");
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.export.test.ts`
  Expected: `6 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.export.test.ts && git commit -m "test(#48): generator envelope + chunking + secret-free payload"`

- [x] **T6 — Elysia streaming route `GET /v1/export`** [AC: AC-1, AC-6, AC-8]

  Create `apps/api/src/modules/settings/settings.export-routes.ts` with the exact content below. Elysia-native rather than oRPC because the response is a stream, not an RPC envelope — the same reason `logos.routes.ts` is Elysia-native (lesson 2026-05-04: never annotate the chain as `Elysia`).

  ```ts
  // apps/api/src/modules/settings/settings.export-routes.ts
  // Story 11-1 (FR-49 / NFR-6 / NFR-30). GET /v1/export — authenticated,
  // streaming GDPR export. Elysia-native, NOT oRPC: the body is a stream, not
  // an RPC envelope (same rationale as logos.routes.ts). Returns an inferred
  // chain — never annotate it as `Elysia` (lesson 2026-05-04).
  //
  // Auth: requireUserContext() is the single chokepoint (Headers → {userId}).
  // It throws PekuloError("UNAUTHORIZED") before any Prisma call, which the
  // app-level .onError maps to 401 (AC-6).
  import { Elysia } from "elysia";
  import { requireUserContext, type JwtVerifier } from "../../platform/security";
  import type { ExtendedPrismaClient } from "../../database";
  import { streamUserDataExport } from "./settings.export";

  export function registerSettingsExportRoutes(deps: {
    client: ExtendedPrismaClient;
    jwtVerifier: JwtVerifier;
  }) {
    return new Elysia({ name: "settings-export" }).get("/v1/export", async ({ request }) => {
      // Throws UNAUTHORIZED before a single row is read.
      const { userId, email } = await requireUserContext(request.headers, deps.jwtVerifier);

      const encoder = new TextEncoder();
      const generator = streamUserDataExport(deps.client, { userId, email });
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { value, done } = await generator.next();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(value));
        },
        async cancel() {
          await generator.return(undefined);
        },
      });

      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          // No filename here — apps/web's proxy owns the user-facing filename.
          "cache-control": "no-store",
        },
      });
    });
  }
  ```

  Run: `cd apps/api && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.export-routes.ts && git commit -m "feat(#48): GET /v1/export streaming route (FR-49)"`

- [x] **T7 — Wire the export route into the settings module** [AC: AC-1, AC-6]

  Replace the whole content of `apps/api/src/modules/settings/settings.module.ts` with:

  ```ts
  // Module factory wiring repository + service + router for the settings
  // domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
  // L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
  // never annotate as `Elysia` or any concrete oRPC implementation type.
  //
  // Story 11-1 adds `exportRoutes`: an Elysia-native streaming route mounted
  // alongside the oRPC router (app.ts), because a stream cannot travel through
  // the oRPC envelope. It needs the JWT verifier directly — mountOrpc's context
  // injection does not cover Elysia-native routes.
  import type { PrismaService } from "../../database";
  import type { JwtVerifier } from "../../platform/security";
  import { createSettingsRepository } from "./settings.repository";
  import { createSettingsService, type SettingsService } from "./settings.service";
  import { createSettingsRouter } from "./settings.routes";
  import { registerSettingsExportRoutes } from "./settings.export-routes";

  export interface SettingsModule {
    service: SettingsService;
    router: ReturnType<typeof createSettingsRouter>;
    exportRoutes: ReturnType<typeof registerSettingsExportRoutes>;
  }

  export function createSettingsModule(deps: {
    prismaService: PrismaService;
    jwtVerifier: JwtVerifier;
  }): SettingsModule {
    const repository = createSettingsRepository({ client: deps.prismaService.client });
    const service = createSettingsService({ repository });
    const router = createSettingsRouter({ service });
    const exportRoutes = registerSettingsExportRoutes({
      client: deps.prismaService.client,
      jwtVerifier: deps.jwtVerifier,
    });
    return { service, router, exportRoutes };
  }
  ```

  Then in `apps/api/src/bootstrap/runtime-dependencies.ts` line 281, replace:

  ```ts
  const settingsModule = createSettingsModule({ prismaService });
  ```

  with:

  ```ts
  const settingsModule = createSettingsModule({ prismaService, jwtVerifier });
  ```

  Then, in the same file, `createRuntimeDependencies` returns an object that exposes the Elysia-native module routers to `app.ts` — and `settingsModule` is **not** currently in it. The return block reads:

  ```ts
    return {
      env: input.env,
      readiness,
      prismaService,
      jwtVerifier,
      orpcRouter,
      milestonePresenceProbe,
      bankAggregatorModule,
      llmModule,
      transactionsModule,
      logosModule,
      suggestionBackfillTask,
    };
  ```

  Replace it with:

  ```ts
    return {
      env: input.env,
      readiness,
      prismaService,
      jwtVerifier,
      orpcRouter,
      milestonePresenceProbe,
      bankAggregatorModule,
      llmModule,
      transactionsModule,
      logosModule,
      settingsModule,
      suggestionBackfillTask,
    };
  ```

  Without this line, `deps.settingsModule` in T8 does not exist and `tsc` fails.

  Run: `cd apps/api && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.module.ts apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#48): wire the export route into the settings module"`

- [x] **T8 — Mount the export route in the Elysia app** [AC: AC-1, AC-6]

  In `apps/api/src/app.ts`, the chain currently ends with the logos proxy before `mountOrpc` is called:

  ```ts
      // Story 6-10 — public logo proxy (GET /v1/logos?ref=). Elysia-native binary
      .use(deps.logosModule.routes);

    mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
  ```

  Replace that fragment with:

  ```ts
      // Story 6-10 — public logo proxy (GET /v1/logos?ref=). Elysia-native binary
      .use(deps.logosModule.routes)
      // Story 11-1 — authenticated GDPR export (GET /v1/export). Elysia-native
      // because the body is a stream. Mounted BEFORE mountOrpc, like the other
      // Elysia-native routers, so the oRPC catch-all cannot shadow it.
      .use(deps.settingsModule.exportRoutes);

    mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
  ```

  `app.ts` declares no explicit deps interface — `deps` is the inferred return of `createRuntimeDependencies`, so T7's added `settingsModule` field is all `deps.settingsModule.exportRoutes` needs.

  Run: `cd apps/api && bunx tsc --noEmit && bun test`
  Expected: `tsc` silent; `bun test` reports `0 fail`, exit 0.
  Commit: `git add apps/api/src/app.ts && git commit -m "feat(#48): mount GET /v1/export before mountOrpc"`

- [x] **T9 — HTTP-boundary integration test: two-user isolation + 401** [AC: AC-3, AC-6]

  Create `apps/api/src/modules/settings/settings.export.integration.test.ts` with the exact content below. It follows the sibling convention (`settings.integration.test.ts`): a real Elysia app, a real jose HS256 verifier, a stubbed data layer. `PORT_BASE` is picked clear of the sibling suites (hypothesis 13900, accounts 14160, holdings 14500, compass 14700, milestones 14900, settings 15100).

  The two-user shape is not optional: per the 2026-05-27 lesson, a single-tenant fixture proves nothing about isolation.

  ```ts
  // Story 11-1, AC-3 + AC-6. HTTP-boundary proof for GET /v1/export:
  //   - an unauthenticated / bad-token request never reaches the data layer (401)
  //   - user A's document contains A's rows and NONE of B's, on every node
  // Two users, always — a single-tenant fixture cannot prove isolation
  // (lesson 2026-05-27).
  import { afterAll, beforeAll, describe, expect, test } from "bun:test";
  import { Elysia } from "elysia";
  import { SignJWT } from "jose";
  import { createJwtVerifier } from "../../platform/security";
  import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
  import { extractRequestId } from "../../common/errors";
  import { registerSettingsExportRoutes } from "./settings.export-routes";
  import { EXPORT_NODES } from "./settings.export";
  import type { ExtendedPrismaClient } from "../../database";

  const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
  const ISSUER = "https://integration.supabase.co/auth/v1";
  const AUDIENCE = "authenticated";
  const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const PORT_BASE = 15300;

  async function signFor(userId: string): Promise<string> {
    return new SignJWT({ email: `${userId}@pekulo.local` })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));
  }

  // Every user-scoped delegate answers findMany({ where: { userId } }) from a
  // two-tenant fixture, so a missing/ignored userId filter shows up as B's row
  // inside A's document.
  let queriesRan = 0;
  function twoTenantClient(): ExtendedPrismaClient {
    const delegate = (owner: string) => ({
      findMany: async ({ where }: { where: { userId: string } }) => {
        queriesRan += 1;
        return [
          { id: `${owner}-a`, userId: USER_A, marker: "row-of-A" },
          { id: `${owner}-b`, userId: USER_B, marker: "row-of-B" },
        ].filter((row) => row.userId === where.userId);
      },
    });
    return new Proxy(
      {},
      { get: (_target, prop: string) => delegate(prop) },
    ) as unknown as ExtendedPrismaClient;
  }

  let stop: (() => Promise<void>) | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = new Elysia()
      .onError(({ error, request }) =>
        mapErrorToOrpcResponse(error, extractRequestId(request.headers)),
      )
      .use(
        registerSettingsExportRoutes({
          client: twoTenantClient(),
          jwtVerifier: createJwtVerifier({
            secret: SECRET,
            issuer: ISSUER,
            audience: AUDIENCE,
          }),
        }),
      );
    const server = app.listen(PORT_BASE);
    baseUrl = `http://localhost:${PORT_BASE}`;
    stop = async () => {
      await server.stop?.();
    };
  });

  afterAll(async () => {
    await stop?.();
  });

  describe("GET /v1/export (story 11-1)", () => {
    test("no Authorization header → 401, no query runs", async () => {
      const before = queriesRan;
      const res = await fetch(`${baseUrl}/v1/export`);
      expect(res.status).toBe(401);
      expect(queriesRan).toBe(before);
    });

    test("invalid Bearer token → 401, no query runs", async () => {
      const before = queriesRan;
      const res = await fetch(`${baseUrl}/v1/export`, {
        headers: { authorization: "Bearer not-a-real-token" },
      });
      expect(res.status).toBe(401);
      expect(queriesRan).toBe(before);
    });

    test("user A's export contains A's rows and none of B's, on every node", async () => {
      const res = await fetch(`${baseUrl}/v1/export`, {
        headers: { authorization: `Bearer ${await signFor(USER_A)}` },
      });
      expect(res.status).toBe(200);
      const raw = await res.text();
      expect(raw).not.toContain("row-of-B");
      expect(raw).not.toContain(USER_B);

      const document = JSON.parse(raw) as Record<string, unknown>;
      expect((document.identity as { user_id: string }).user_id).toBe(USER_A);
      for (const node of EXPORT_NODES) {
        const payload = document[node.key] as { rows: { userId: string }[] };
        expect(payload, `node ${node.key} missing from the document`).toBeDefined();
        for (const row of payload.rows) {
          expect(row.userId, `node ${node.key} leaked a row of another tenant`).toBe(USER_A);
        }
      }
    });

    test("user B gets B's rows, symmetrically", async () => {
      const res = await fetch(`${baseUrl}/v1/export`, {
        headers: { authorization: `Bearer ${await signFor(USER_B)}` },
      });
      const raw = await res.text();
      expect(raw).not.toContain("row-of-A");
      expect(raw).toContain("row-of-B");
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.export.integration.test.ts`
  Expected: `4 pass`, `0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.export.integration.test.ts && git commit -m "test(#48): two-user isolation + 401 at the export HTTP boundary (AC-3, AC-6)"`

- [x] **T10 — Authenticated same-origin proxy on apps/web** [AC: AC-1, AC-6]

  Create `apps/web/src/app/v1/export/route.ts` with the exact content below.

  🔒 **The path must never contain a dot.** `apps/web/src/proxy.ts:103` computes `isStatic = pathname.includes(".")` and skips the session check entirely for such paths — a route at `/v1/export/pekulo-export.json` would serve every user's data **unauthenticated**. The filename lives in `Content-Disposition`, never in the URL. Do not "improve" this by putting the filename in the path.

  ```ts
  // apps/web/src/app/v1/export/route.ts
  // Story 11-1 (FR-49). Authenticated same-origin proxy for the GDPR export.
  // Mirrors the shape of v1/logos/route.ts (forward to apps/api, stream the
  // body back) with the opposite auth posture: /v1/logos is deliberately
  // PUBLIC and bypassed in proxy.ts; /v1/export is deliberately NOT — it must
  // stay out of that bypass list forever.
  //
  // 🔒 The route path carries NO dot. proxy.ts treats any path containing "."
  // as a static asset and skips the session check — a filename in the URL would
  // make this endpoint unauthenticated. The filename is set here, in the
  // Content-Disposition header.
  import { NextResponse } from "next/server";
  import { ensureRequestContext } from "@/lib/orpc/request-context";

  const EXPORT_TIMEOUT_MS = 60_000; // NFR-6 budget.

  export async function GET() {
    let accessToken: string;
    try {
      ({ accessToken } = await ensureRequestContext());
    } catch {
      // No session — never touch apps/api (AC-6).
      return new NextResponse("unauthorized", { status: 401 });
    }

    const apiBase = process.env.API_BASE_URL;
    if (!apiBase) return new NextResponse("export unavailable", { status: 503 });

    const upstream = `${apiBase.replace(/\/$/, "")}/v1/export`;
    let res: Response;
    try {
      res = await fetch(upstream, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
      });
    } catch {
      return new NextResponse("export failed", { status: 504 });
    }

    if (!res.ok || !res.body) {
      return new NextResponse("export failed", { status: res.status === 401 ? 401 : 502 });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pekulo-export-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add apps/web/src/app/v1/export/route.ts && git commit -m "feat(#48): authenticated same-origin export proxy"`

- [x] **T11 — Route-handler tests** [AC: AC-6]

  Create `apps/web/src/app/v1/export/route.test.ts` with the exact content below.

  ```ts
  import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

  const ensureRequestContext = vi.fn();
  vi.mock("@/lib/orpc/request-context", () => ({
    ensureRequestContext: () => ensureRequestContext(),
  }));

  const { GET } = await import("./route");

  const realFetch = globalThis.fetch;
  const prevApiBase = process.env.API_BASE_URL;

  beforeEach(() => {
    process.env.API_BASE_URL = "http://api.test";
    ensureRequestContext.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.API_BASE_URL = prevApiBase;
  });

  describe("/v1/export route handler (story 11-1 / FR-49)", () => {
    test("no session → 401 and apps/api is never called", async () => {
      let fetched = false;
      globalThis.fetch = (async () => {
        fetched = true;
        return new Response("", { status: 200 });
      }) as unknown as typeof fetch;
      ensureRequestContext.mockRejectedValue(new Error("UNAUTHORIZED"));

      const res = await GET();
      expect(res.status).toBe(401);
      expect(fetched).toBe(false);
    });

    test("forwards the session Bearer token to the server-side API_BASE_URL", async () => {
      let calledUrl = "";
      let calledAuth = "";
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        calledUrl = typeof url === "string" ? url : String(url);
        calledAuth = String((init?.headers as Record<string, string>)?.authorization ?? "");
        return new Response('{"schema_version":"1.0.0"}', { status: 200 });
      }) as unknown as typeof fetch;
      ensureRequestContext.mockResolvedValue({
        accessToken: "tok-123",
        userId: "u",
        email: null,
      });

      const res = await GET();
      expect(calledUrl).toBe("http://api.test/v1/export");
      expect(calledAuth).toBe("Bearer tok-123");
      expect(res.status).toBe(200);
    });

    test("sets a Content-Disposition attachment filename, not a URL path", async () => {
      globalThis.fetch = (async () =>
        new Response('{"schema_version":"1.0.0"}', { status: 200 })) as unknown as typeof fetch;
      ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

      const res = await GET();
      expect(res.headers.get("content-disposition")).toMatch(
        /^attachment; filename="pekulo-export-\d{4}-\d{2}-\d{2}\.json"$/,
      );
      expect(res.headers.get("cache-control")).toBe("no-store");
    });

    test("upstream 401 is relayed as 401", async () => {
      globalThis.fetch = (async () =>
        new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
      ensureRequestContext.mockResolvedValue({ accessToken: "t", userId: "u", email: null });

      const res = await GET();
      expect(res.status).toBe(401);
    });
  });
  ```

  Run: `cd apps/web && bunx vitest run src/app/v1/export/route.test.ts`
  Expected: `Tests  4 passed (4)`, exit 0.
  Commit: `git add apps/web/src/app/v1/export/route.test.ts && git commit -m "test(#48): export proxy auth + headers (AC-6)"`

- [x] **T12 — i18n keys for the « Vos données » section** [AC: AC-7]

  In `apps/web/messages/fr.json`, inside the existing `"settings"` object (which currently holds `appearance`, `theme`, `lang`), add a `"data"` key so the object reads:

  ```json
  "settings": {
    "appearance": {
      "title": "Apparence",
      "theme": "Thème",
      "language": "Langue"
    },
    "theme": {
      "system": "Système",
      "dark": "Sombre",
      "light": "Clair"
    },
    "lang": {
      "fr": "Français",
      "en": "English"
    },
    "data": {
      "title": "Vos données",
      "exportLabel": "Exporter mes données",
      "exportSub": "JSON complet · conforme RGPD",
      "exportAction": "Exporter"
    }
  }
  ```

  Apply the same `"data"` block to `apps/web/messages/en.json` with:

  ```json
  "data": {
    "title": "Your data",
    "exportLabel": "Export my data",
    "exportSub": "Complete JSON · GDPR compliant",
    "exportAction": "Export"
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit && node -e "JSON.parse(require('fs').readFileSync('messages/fr.json','utf8'));JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));console.log('both parse')"`
  Expected: `both parse`, exit 0.
  Commit: `git add apps/web/messages/fr.json apps/web/messages/en.json && git commit -m "feat(#48): i18n for the Vos données section"`

- [x] **T13 — « Vos données » section + export row** [AC: AC-7]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.tsx` with the exact content below. It is a Client Component only because `PekuloSettingRow` is one; there is no oRPC call and therefore no hook and no server action — ADR-0010's Component → Hook → Server Action triad governs oRPC calls, and a plain authenticated GET does not make one. (This is the documented deviation from #48's Summary, which named a `use-export-data.ts`.)

  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.tsx
  // Story 11-1 (FR-49). The download is a plain authenticated GET to the
  // same-origin proxy — the browser handles it natively via the anchor's
  // `download` attribute plus the proxy's Content-Disposition header. No oRPC
  // call is made from this component, so ADR-0010's hook/server-action triad
  // does not apply (it governs oRPC calls, of which this makes none).
  import { Download } from "lucide-react";
  import { PekuloSettingRow } from "@pekulo/ui";

  export interface ExportDataRowProps {
    label: string;
    sub: string;
    action: string;
  }

  export function ExportDataRow({ label, sub, action }: ExportDataRowProps) {
    return (
      <PekuloSettingRow
        label={label}
        sub={sub}
        action={
          <a
            href="/v1/export"
            download
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <Download size={14} strokeWidth={2} aria-hidden />
            {action}
          </a>
        }
      />
    );
  }
  ```

  Then create `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx`:

  ```tsx
  // apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx
  // Story 11-1 (FR-49). Server Component. Placement is dictated by the
  // ux-preview SSOT (docs/ux-preview/src/App.tsx → SettingsScreen): the
  // « Vos données » Section sits after « Intelligence artificielle ». The
  // second row of that preview section — "Supprimer mon compte" (destructive)
  // — belongs to story 11-2 and is deliberately absent here.
  import { getTranslations } from "next-intl/server";
  import { Section } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";
  import { ExportDataRow } from "./export-data-row";

  export async function DataSection() {
    const t = await getTranslations("settings");
    return (
      <Section ariaLabel={t("data.title")} title={t("data.title")}>
        <View flexDirection="column">
          <ExportDataRow
            label={t("data.exportLabel")}
            sub={t("data.exportSub")}
            action={t("data.exportAction")}
          />
        </View>
      </Section>
    );
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: no output, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data" && git commit -m "feat(#48): Vos données section + export row (FR-49)"`

- [x] **T14 — a11y test for the section** [AC: AC-7]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.a11y.test.tsx` with the exact content below. It renders the client row directly (the Section wrapper is an RSC and is covered by the sibling `appearance-section.a11y.test.tsx` pattern).

  ```tsx
  import { describe, expect, it } from "vitest";
  import { axe } from "vitest-axe";
  import { ExportDataRow } from "./export-data-row";
  import { renderWithTamagui } from "../../../../../../test/setup";

  // Story 11-1, AC-7. PekuloSettingRow renders Tamagui primitives, so it must be
  // mounted through the TamaguiTestProvider wrapper — a bare
  // @testing-library/react render throws on the missing Tamagui context. Same
  // helper and same relative depth as the sibling
  // _appearance/_components/appearance-section.a11y.test.tsx.
  describe("ExportDataRow a11y (story 11-1)", () => {
    it("has no axe violations", async () => {
      const { container } = renderWithTamagui(
        <ExportDataRow
          label="Exporter mes données"
          sub="JSON complet · conforme RGPD"
          action="Exporter"
        />,
      );
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("exposes the download link with an accessible name", () => {
      const { getByRole } = renderWithTamagui(
        <ExportDataRow
          label="Exporter mes données"
          sub="JSON complet · conforme RGPD"
          action="Exporter"
        />,
      );
      const link = getByRole("link", { name: "Exporter" });
      expect(link.getAttribute("href")).toBe("/v1/export");
      expect(link.hasAttribute("download")).toBe(true);
    });
  });
  ```

  Run: `cd apps/web && bunx vitest run "src/app/(cap)/dashboard/_data/_components/data-section.a11y.test.tsx"`
  Expected: `Tests  2 passed (2)`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/data-section.a11y.test.tsx" && git commit -m "test(#48): a11y for the export row (AC-7)"`

- [x] **T15 — Mount the section on the Paramètres page** [AC: AC-7]

  In `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`, add the import alongside the existing ones:

  ```tsx
  import { DataSection } from "../_data/_components/data-section";
  ```

  Then update the trailing comment block and the JSX. The comment currently ends with:

  ```
  // Session (Se déconnecter) → Hypothèse (last). « Vos données » (export/delete)
  // isn't built yet; Compass (cap config, a Pekulo-only addition absent from
  // ux-preview) takes the slot before Session.
  ```

  Replace those three lines with:

  ```
  // Session (Se déconnecter) → Hypothèse (last). « Vos données » holds the export
  // row (story 11-1); its second preview row, "Supprimer mon compte", lands with
  // story 11-2. Compass (cap config, a Pekulo-only addition absent from
  // ux-preview) takes the slot before Session.
  ```

  And in the JSX, insert `<DataSection />` immediately after `<LlmActivityLogLink />` so the order becomes:

  ```tsx
          <AccountSection />
          <AppearanceSection />
          <LlmOptInToggle />
          <LlmActivityLogLink />
          <DataSection />
          <CompassEditForm />
          <CompassHistoryPanel />
          <SessionSection />
          <HypothesisSettings />
  ```

  Run: `cd apps/web && bunx tsc --noEmit && bunx vitest run`
  Expected: `tsc` silent; vitest reports `0 failed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/parametres/page.tsx" && git commit -m "feat(#48): mount Vos données on the Paramètres page (AC-7)"`

- [x] **T16 — Doc + ticket sync** [AC: AC-1]

  Three artefacts disagree with what this story ships; fix all three in one pass (2026-05-31 lesson: doc drift introduced during a story must land inside that story, not after it).

  1. In `docs/epics.md`, under `## Epic 11: Public-ramp readiness`, the Sequencing line reads:

     ```
     **Sequencing:** Backlog. `11-3` (RLS audit + encryption doc) is priorité — it prevents regressions in every new domain story. The other five wait for the (b) decision.
     ```

     Replace it with:

     ```
     **Sequencing:** Mixed tier. `11-3` (RLS audit + encryption doc) shipped first — it prevents regressions in every new domain story. `11-1` (export) and `11-2` (deletion) are **V1 (a)**, not (b)-gated: `docs/rgpd-readiness.md` establishes that GDPR applies from the first user other than the author, and V1 (a) onboards proches. `11-4` (axe + WCAG gates) is pulled into V1 (a) by `docs/v1-definition-of-done.md` §1. `11-5` and `11-6` still wait for the (b) decision.
     ```

  2. In `docs/epics.md`, under the `### Ramp tiering` table, the row reads:

     ```
     | Public-ramp backlog | epic-11 (11-3 priorité tôt; reste gated sur (b) decision)                      |
     ```

     Replace it with:

     ```
     | Public-ramp backlog | epic-11 (11-1/11-2/11-3/11-4 = V1 (a); 11-5/11-6 gated sur (b) decision)      |
     ```

  3. In `docs/rgpd-readiness.md` § "1. Data-subject rights — CODE", the export line reads:

     ```
     - [ ] **Access / portability** → export all user data as JSON — **#48 / story 11-1** (`pending`). DR-5, ≤ 60 s.
     ```

     Replace `(`pending`)` with `(`in-progress`, story file `docs/stories/11-1-data-export.md`)` so the readiness doc points at the artefact.

  Then retag the ticket so the label stops contradicting the plan:

  ```bash
  gh issue edit 48 --repo yabafre/pekulo --remove-label "tier/backlog" --add-label "tier/v1"
  ```

  Run: `bash .aped/scripts/validate-epics.sh docs/epics.md`
  Expected: exit 0.
  Commit: `git add docs/epics.md docs/rgpd-readiness.md && git commit -m "docs(#48): realign epic-11 tiering — 11-1/11-2/11-4 are V1 (a)"`

## Dev Notes

### Existing code at write time

Step-0 verbatim quotes of every file this story **modifies**. Anything not quoted here is a new file.

`apps/api/src/modules/settings/settings.module.ts` (current, complete):

```ts
// Module factory wiring repository + service + router for the settings
// domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
// L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
// never annotate as `Elysia` or any concrete oRPC implementation type.
import type { PrismaService } from "../../database";
import { createSettingsRepository } from "./settings.repository";
import { createSettingsService, type SettingsService } from "./settings.service";
import { createSettingsRouter } from "./settings.routes";

export interface SettingsModule {
  service: SettingsService;
  router: ReturnType<typeof createSettingsRouter>;
}

export function createSettingsModule(deps: { prismaService: PrismaService }): SettingsModule {
  const repository = createSettingsRepository({ client: deps.prismaService.client });
  const service = createSettingsService({ repository });
  const router = createSettingsRouter({ service });
  return { service, router };
}
```

This story adds an `exportRoutes` field and a `jwtVerifier` dependency. The `service` / `router` fields and their wiring are untouched.

`apps/api/src/bootstrap/runtime-dependencies.ts:281` (current):

```ts
  const settingsModule = createSettingsModule({ prismaService });
```

`jwtVerifier` is already in scope at that point (created at line 79 and returned at line 302), so the change is the argument list only.

`apps/api/src/app.ts` (current fragment, lines ~113-117):

```ts
    // Story 6-10 — public logo proxy (GET /v1/logos?ref=). Elysia-native binary
    .use(deps.logosModule.routes);

  mountOrpc(app, { jwtVerifier: deps.jwtVerifier, orpcRouter: deps.orpcRouter });
```

Elysia-native routers are mounted **before** `mountOrpc` (the Bridge webhook receiver and the LLM attest listener carry explicit comments saying so). The export route follows that rule.

`apps/web/src/app/(cap)/dashboard/parametres/page.tsx` (current JSX body):

```tsx
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: pekuloSpacing[6],
        }}
      >
        <AccountSection />
        <AppearanceSection />
        <LlmOptInToggle />
        <LlmActivityLogLink />
        <CompassEditForm />
        <CompassHistoryPanel />
        <SessionSection />
        <HypothesisSettings />
      </div>
```

`packages/validators/src/settings/index.ts` (current, complete):

```ts
export * from "./settings.schemas";
```

`apps/web/messages/fr.json` → `settings` (current, complete):

```json
"settings": {
  "appearance": { "title": "Apparence", "theme": "Thème", "language": "Langue" },
  "theme": { "system": "Système", "dark": "Sombre", "light": "Clair" },
  "lang": { "fr": "Français", "en": "English" }
}
```

`docs/epics.md` and `docs/rgpd-readiness.md` fragments are quoted inline in T16.

### File decisions

| File | Single responsibility | Inputs → Outputs |
|---|---|---|
| `docs/exports/schema-v1.json` | The published JSON Schema NFR-30 names | none → consumed by T1's ajv check and by users validating their file |
| `packages/validators/src/settings/export.schemas.ts` | Zod mirror of the export envelope + the two version constants | `@pekulo/zod` → `userDataExportSchema`, `EXPORT_SCHEMA_VERSION`, `EXPORT_NODE_SCHEMA_VERSION` |
| `apps/api/src/modules/settings/settings.export.ts` | The 21-node table map and the chunked generator | `ExtendedPrismaClient`, `decimalToNumber`, validators → `EXPORT_NODES`, `streamUserDataExport` |
| `apps/api/src/modules/settings/settings.export-routes.ts` | Authenticate, then hand the generator to a `ReadableStream` | `requireUserContext`, `streamUserDataExport` → an Elysia chain exposing `GET /v1/export` |
| `apps/api/src/modules/settings/settings.export-map.guard.test.ts` | Fail the build when the model set drifts from the export map | Prisma DMMF, `EXPORT_NODES` → pass/fail |
| `apps/api/src/modules/settings/settings.export.test.ts` | Prove the envelope, the chunking, and the absence of secrets | `streamUserDataExport` → pass/fail |
| `apps/api/src/modules/settings/settings.export.integration.test.ts` | Prove 401 and two-user isolation at the HTTP boundary | real Elysia + jose verifier + two-tenant stub → pass/fail |
| `apps/web/src/app/v1/export/route.ts` | Authenticate the browser, forward the Bearer, stream back with a filename | `ensureRequestContext`, `API_BASE_URL` → a streamed attachment response |
| `apps/web/src/app/v1/export/route.test.ts` | Prove the proxy never calls apps/api without a session | mocked `ensureRequestContext` + `fetch` → pass/fail |
| `apps/web/…/_data/_components/data-section.tsx` | The « Vos données » Section wrapper (RSC, i18n) | `next-intl`, `@pekulo/ui#Section` → JSX |
| `apps/web/…/_data/_components/export-data-row.tsx` | The single download row | `PekuloSettingRow`, `lucide-react#Download` → JSX |
| `apps/web/…/_data/_components/data-section.a11y.test.tsx` | axe + accessible-name proof for the row | `vitest-axe`, `@testing-library/react` → pass/fail |

### Architecture

- **Why not oRPC.** `packages/contracts` stays untouched. The export body is a stream; the oRPC envelope is not. `logos.routes.ts` (apps/api) and `v1/logos/route.ts` (apps/web) are the in-repo precedent for an Elysia-native route plus a same-origin Next proxy, and this story copies that shape with the opposite auth posture. ADR-0009 governs RPC procedures; this is not one.
- **Why no hook and no server action.** ADR-0010's Component → Hook → Server Action boundary governs oRPC calls from the web tier. This component makes none — the browser performs a plain authenticated GET. Ticket #48's Summary names a `use-export-data.ts`; that file does not exist under this design, and the omission is deliberate.
- **Tenant isolation.** `apps/api` connects with the Supabase service role, which **bypasses RLS** (ADR-0013). The only tenant boundary on this path is the explicit `where: { userId }` on every read, enforced by the `pekulo/no-prisma-query-without-user-id` oxlint rule. A 21-table fan-out is the largest single concentration of that risk in the codebase to date — which is why AC-3 is proven with two users at the HTTP boundary rather than with a unit test.
- **Decimal handling.** Prisma returns `Decimal` columns as decimal.js instances. The generator's replacer routes them through `decimalToNumber` (`apps/api/src/common/derive/decimal-to-number.ts`). Inlining `Number(decimal)` or re-implementing the helper is a review fail (lesson L24). Consequence to accept knowingly: monetary values are exported as JSON numbers, consistent with every DTO the API already returns, rather than as exact decimal strings.
- **`schema_version` in two places.** NFR-30 mandates a root-level field; ticket #48 AC-2 mandates one per top-level node. Both are emitted. The node version is separate so a single node's shape can evolve without a document-wide bump.

### Testing

- apps/api → `bun test` (`cd apps/api && bun test <path>`). Integration tests boot a real Elysia app with a real jose HS256 verifier and a **stubbed data layer** — that is the sibling convention (`settings.integration.test.ts` header states it explicitly), not a shortcut.
- apps/web → vitest (`cd apps/web && bunx vitest run <path>`).
- Cross-workspace commands must use the workspace name, never the folder name: `bun --filter=@pekulo/api …`, `bun --filter=@pekulo/web …` (lesson 2026-05-19). `bun --cwd <relative> run <script>` silently exits 0 and must never appear (lesson 2026-05-05).
- Full suite before opening the PR: `bun --filter='*' run test`.

### Dependencies

- No new runtime dependency. `ajv-cli` in T1 is invoked one-shot via `bunx` and is not added to any `package.json`.
- `jose`, `elysia`, `vitest-axe`, `@testing-library/react`, `lucide-react` are all already in the workspace.

### Commit prefix

`feat(#48): …` / `test(#48): …` / `docs(#48): …`. Final PR body carries `Closes #48`.

### Out of scope — do not build

- **Account deletion** (`11-2` / #49). The ux-preview « Vos données » section shows a second, destructive row; it belongs to that story. Adding it here is scope creep.
- **A ZIP archive or a README inside the export.** JSON alone satisfies GDPR's "structured, commonly used, machine-readable" requirement. Decided at the step-04 gate.
- **Field-level encryption or IBAN redaction.** `docs/security.md` records field-level IBAN encryption as deferred future hardening; this story exports what the database holds.
- **Fixing `EXPECTED_POLICY_COUNTS` in `apps/api/scripts/rls-audit.ts`.** `dashboard_layout` is genuinely missing from that list (20 entries, 21 tables) and the DB-backed probe therefore never checks it. It is **not** a security hole — migration `20260604172000_dashboard_layout` enables RLS with 3 policies — and it is not this story's job. Raise it via `aped-triage` as an 11-3 follow-up.

## File List

**Created (12)**

- `docs/exports/schema-v1.json`
- `packages/validators/src/settings/export.schemas.ts`
- `apps/api/src/modules/settings/settings.export.ts`
- `apps/api/src/modules/settings/settings.export.test.ts`
- `apps/api/src/modules/settings/settings.export-map.guard.test.ts`
- `apps/api/src/modules/settings/settings.export-routes.ts`
- `apps/api/src/modules/settings/settings.export.integration.test.ts`
- `apps/web/src/app/v1/export/route.ts`
- `apps/web/src/app/v1/export/route.test.ts`
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx`
- `apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.tsx`
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.a11y.test.tsx`

**Modified (9)**

- `packages/validators/src/settings/index.ts` — re-export the new schemas
- `apps/api/src/modules/settings/settings.module.ts` — expose `exportRoutes`, take `jwtVerifier`
- `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `jwtVerifier` to `createSettingsModule`
- `apps/api/src/app.ts` — mount `settingsModule.exportRoutes` before `mountOrpc`
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — mount `<DataSection />` after `<LlmActivityLogLink />`
- `apps/web/messages/fr.json` + `apps/web/messages/en.json` — `settings.data.*` keys
- `docs/epics.md` + `docs/rgpd-readiness.md` — epic-11 tiering realignment (T16)
- `.gitleaks.toml` — widen the integration-test allowlist by exactly one optional
  dotted segment so `settings.export.integration.test.ts` stops tripping the
  generic-api-key rule on the fake JWT secret every sibling suite uses
- `docs/architecture.md` — correct the FR-49 row and the `settings-actions.ts` tree
  line: neither `settings.service.ts#exportData` nor `use-export-data.ts` exists
  under this design (a stream cannot travel through the oRPC envelope, and the
  browser makes no oRPC call, so ADR-0010's triad does not apply)

Both were added mid-flight and recorded only in the Dev Agent Record; the
2026-05-31 lesson requires them here too. Listed during aped-review.

**Added or moved during aped-review**

- `apps/api/src/modules/settings/settings.export.schema.test.ts` (NEW) — validates a
  generated document against `docs/exports/schema-v1.json` itself (AC-1)
- `apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.a11y.test.tsx`
  (RENAMED from `data-section.a11y.test.tsx`) — now also mounts the `Section`
  landmark and `DataSection`, plus fr/en key parity
- `packages/validators/src/data-export/data-export.schemas.ts` (MOVED from
  `settings/export.schemas.ts`) + `data-export/index.ts` — R11 conformance
- `packages/validators/src/index.ts` — export the new `data-export` domain
- `apps/web/src/proxy.ts` — answer `401` on the exact path `/v1/export` instead of
  redirecting to `/login`
- `apps/api/package.json`, `bun.lock` — `ajv` + `ajv-formats` devDependencies

Per-file responsibilities and their inputs/outputs are in Dev Notes § File decisions.

## Dev Agent Record

- **Model:** claude-opus-5[1m]
- **Started:** 2026-08-29T13:00:00Z
- **Completed:** 2026-08-29T15:15:00Z

### Summary

GDPR portability export shipped end to end: a published JSON Schema, a Zod
mirror of the envelope, a 21-node table map fronted by a chunked async
generator, an Elysia-native `GET /v1/export` behind `requireUserContext`, an
authenticated same-origin proxy on apps/web, and the « Vos données » row on
Paramètres. Scope held — account deletion, ZIP packaging and IBAN redaction
stayed out.

Two things dominated the session. First, the story's verbatim code blocks did
not compile or pass as written (seven separate defects, listed below) — every
one was caught by `tsc` or by a witnessed RED, none by reading. Second, the
working copy was broken before the story started: `node_modules` lives in
iCloud Drive and several packages had been evicted to dataless stubs, so
`@pekulo/zod` resolved to a namespace with no `z.string`. `apps/api/src/config/env.ts`
— untouched by this story — failed the same way, meaning the API could not
boot. A clean reinstall fixed it, and `com.apple.fileprovider.ignore#P` on the
`node_modules` trees (user-approved) stopped iCloud starving tsc/vitest: the
apps/web suite went from an indefinite hang at 0 % CPU to 59 s.

### Files changed

- `docs/exports/schema-v1.json` (NEW) — the published artefact NFR-30 names
- `packages/validators/src/settings/export.schemas.ts` (NEW) — Zod mirror of the envelope
- `packages/validators/src/settings/index.ts` — re-export the new schemas
- `apps/api/src/modules/settings/settings.export.ts` (NEW) — 21-node map + chunked generator
- `apps/api/src/modules/settings/settings.export.test.ts` (NEW) — envelope, chunking, Decimal, secret-free
- `apps/api/src/modules/settings/settings.export-map.guard.test.ts` (NEW) — DMMF drift guard
- `apps/api/src/modules/settings/settings.export-routes.ts` (NEW) — Elysia-native `GET /v1/export`
- `apps/api/src/modules/settings/settings.export.integration.test.ts` (NEW) — two-tenant isolation + 401
- `apps/api/src/modules/settings/settings.module.ts` — expose `exportRoutes`, take `jwtVerifier`
- `apps/api/src/bootstrap/runtime-dependencies.ts` — pass `jwtVerifier`, expose `settingsModule`
- `apps/api/src/app.ts` — mount the export route before `mountOrpc`
- `apps/web/src/app/v1/export/route.ts` (NEW) — authenticated same-origin proxy
- `apps/web/src/app/v1/export/route.test.ts` (NEW) — proxy auth + headers
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx` (NEW) — the RSC Section
- `apps/web/src/app/(cap)/dashboard/_data/_components/export-data-row.tsx` (NEW) — the download row
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.a11y.test.tsx` (NEW) — axe + accessible name
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` — mount `<DataSection />`
- `apps/web/messages/{fr,en}.json` — `settings.data.*`
- `.gitleaks.toml` — allow one dotted segment in the apps/api integration-test path
- `docs/epics.md`, `docs/rgpd-readiness.md`, `docs/architecture.md` — tiering + FR-49 mapping realignment
- `docs/state.yaml`, `docs/epics-context/epic-11-context.md`, `docs/stories/11-1-data-export.md` — APED state

### Deviations

**The story's verbatim code did not compile or pass as written.** Seven fixes:

1. **T7 — `RuntimeDeps` is an explicit interface.** The story only patched the
   `return` block; adding `settingsModule` there without adding the field to
   `RuntimeDeps` is an excess-property error. Added the field.
2. **T9 — `extractRequestId(request.headers)` is wrong twice.** The helper takes
   the thrown error, not headers, and returns `string | undefined` while
   `mapErrorToOrpcResponse` requires `string` — a typecheck error.
3. **T9 — the `.onError` never set `set.status`.** As written the 401 responses
   would have come back 200 and every auth assertion would have passed for the
   wrong reason. Now mirrors `settings.integration.test.ts`.
4. **T9 — fixed port and un-awaited `listen`.** Replaced with the sibling
   convention: `PORT_BASE + random(200)` on `127.0.0.1`, listen callback awaited.
5. **T13 — the bare `<a>` would have rendered « Exporter » in serif.**
   `--f-family` is scoped to Tamagui's `font_*` classes, so raw DOM text inside
   a `View` falls back to the browser default (lesson 2026-07-13, 4th
   occurrence of this class). The label now rides a Tamagui `<Text>`, matching
   `llm-activity-log-link.tsx`. The a11y test confirms the accessible name is
   unchanged.
6. **T5 — the test did not compile under `noUncheckedIndexedAccess`.** Five
   TS2532/TS18048 on `parsed[node.key].rows[0]`. Bound locally + asserted.
7. **T1 — `bunx ajv-cli compile --spec=draft2020` fails on `format: date-time`**
   (ajv strict mode, no `ajv-formats` in the ephemeral install; `npx -p` timed
   out). Verified instead with a one-shot ajv script in the scratchpad, strict
   mode ON and formats enabled: the schema compiles, accepts a well-formed
   document, and rejects a non-UUID `user_id` plus an extra node key.

**Scope additions, both mandated by the 2026-05-31 doc-drift lesson:**

- `.gitleaks.toml` — the allowlist regex `[a-z-]+\.integration\.test\.ts` has
  no dotted stem, so `settings.export.integration.test.ts` tripped the
  generic-api-key rule on the same fake JWT secret every sibling suite uses.
  Widened by exactly one optional dotted segment, not to `.+`.
- `docs/architecture.md` — the FR-49 row mapped the export to
  `settings.service.ts#exportData` plus a `use-export-data.ts` hook. Neither
  exists under this design and the story deviates deliberately (a stream cannot
  travel through the oRPC envelope; the browser makes no oRPC call so ADR-0010's
  triad does not apply). Row and the `settings-actions.ts` tree line corrected.

**Commit grouping — 12 commits for 16 tasks.** T6/T7/T8 landed together because
the module factory's new `jwtVerifier` argument and `app.ts`'s new mount do not
typecheck apart; T3+T5, T10+T11 and T13+T14 each landed as implementation plus
the test that proves it, so no commit is red on its own.

**Environment repair (pre-existing, not introduced here):** `node_modules` was
partially evicted by iCloud to dataless stubs — `zod` and `@orpc/server` read as
empty. Full reinstall (2494 packages, `bun.lock` unchanged), then
`com.apple.fileprovider.ignore#P` on every `node_modules` tree with the user's
approval. Pre-commit hooks dropped from 137 s to 0.4 s as a side effect.

**Known verification gaps, deliberately left for review:**

- No automated test validates a produced document against
  `docs/exports/schema-v1.json` itself — the suite validates against the Zod
  mirror. The JSON Schema was exercised manually with ajv this session. Closing
  it properly means adding `ajv` as an apps/api devDependency, which is a HALT
  condition inside a story.
- NFR-6's 60 s budget is a design argument (streaming, one chunk per table), not
  a measurement: the tests stub the data layer, so no wall-clock figure exists
  for Persona #1's real volume.
- AC-7's section ORDER and the `en` rendering are not asserted by a test —
  `tsc`, the catalogs and the page diff cover them, nothing else does.
- **No visual pass.** `react-grab-mcp` failed to connect this session
  (CONNECT_TIMEOUT), so the « Vos données » row was never seen rendered. Given
  the 2026-05-24 / 2026-07-13 / 2026-07-29 run of defects that only a live pass
  caught, this one deserves an explicit look.
- `packages/validators` has no `typescript` devDependency, so
  `bun --filter='@pekulo/validators' run typecheck` exits 127 (`tsc: command not
  found`); verified with `bunx tsc --noEmit` instead. Pre-existing, same class as
  the 2026-05-05 per-package-typescript lesson. Out of scope here.

### Test output

```
apps/api      bun test          → 918 pass, 0 fail, 2497 expect() · 107 files · exit 0
apps/web      vitest run        → 112 files passed, 370 tests passed · exit 0
packages/ui   vitest run        → 158 files passed, 294 passed | 1 skipped · exit 0
apps/api      tsc --noEmit      → exit 0, no output
apps/web      tsc --noEmit      → exit 0, no output
validators    bunx tsc --noEmit → exit 0, no output
docs/exports  ajv (strict, formats) → schema valid; accepts a conforming document,
                                      rejects a non-UUID user_id + an extra node key
```

Story-owned suites: `settings.export.test.ts` 6 · `settings.export-map.guard.test.ts` 5
· `settings.export.integration.test.ts` 4 · `route.test.ts` 4 ·
`data-section.a11y.test.tsx` 2 = **21 tests**.

RED witnessed before each implementation: `settings.export{,-map.guard}.test.ts`
(module `./settings.export` missing), `settings.export.integration.test.ts`
(module `./settings.export-routes` missing), `route.test.ts` +
`data-section.a11y.test.tsx` (modules `./route` and `./export-data-row`
missing). AC-5's guard was additionally mutation-tested: dropping
`dashboard_layout` from `EXPORT_NODES` and one column from
`bankConnectionExportSelect` turned it red and named `DashboardLayout`.

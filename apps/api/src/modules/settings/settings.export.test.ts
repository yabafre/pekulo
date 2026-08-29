// Story 11-1 — generator-level proof: envelope shape (AC-2), one chunk per
// node (AC-8), Decimal serialisation, and no vault secret in the payload (AC-4).
//
// AC-2 (verbatim from story 11-1-data-export:16):
//   Given the downloaded payload, When it is parsed, Then the document root
//   carries a `schema_version` field and every top-level node (`identity` plus
//   each table node) carries its own `schema_version`.
// AC-4 (verbatim from story 11-1-data-export:18):
//   Given a user holding a Bridge `bank_connection`, When they export, Then
//   the payload carries the connection metadata (provider, providerItemId,
//   status, displayName, providerId, timestamps) and carries neither
//   `accessTokenSecretId` nor `refreshTokenSecretId` (Supabase Vault
//   references).
// AC-8 (verbatim from story 11-1-data-export:22):
//   Given a user whose data spans every table, When the export response is
//   produced, Then the server emits it incrementally — a header fragment,
//   then exactly one fragment per table, then a closing fragment — so peak
//   memory tracks the largest single table rather than the total payload.
import { describe, expect, it } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import type { ExtendedPrismaClient } from "../../database";
import { EXPORT_NODES, bankConnectionExportSelect, streamUserDataExport } from "./settings.export";
import { userDataExportSchema } from "@pekulo/validators";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GENERATED_AT = new Date("2026-08-29T10:00:00.000Z");

// Answers `client.<anyModel>.findMany(...)` for every delegate the node map
// reaches for, so the generator can run without a database.
//
// Two properties this fixture MUST keep (both added in aped-review of 11-1):
//
//  1. It HONOURS `select`. The previous fixture destructured `{ where }` only,
//     so `bankConnectionExportSelect` was never exercised at the call site and
//     deleting `select:` from settings.export.ts survived the whole suite.
//  2. The raw `bankConnection` row CARRIES both Vault secret columns, exactly
//     as Postgres hands them back. Without them the "no vault secret anywhere"
//     assertion had nothing to catch and could not fail.
//
// Together they make the AC-4 assertions load-bearing: drop the `select`
// allowlist and this suite goes red naming the leaked column.
function rawRow(model: string, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: `${model}-1`,
    userId,
    // A REAL Prisma.Decimal, not a `{ toNumber }` stand-in: decimal.js defines
    // `toJSON`, and JSON.stringify calls it BEFORE any replacer. A fake without
    // `toJSON` diverges from the real object on precisely the member that
    // decides the serialised output.
    cashBalance: new Prisma.Decimal("1234.56"),
  };
  if (model === "bankConnection") {
    // The full row Postgres hands back: every allowlisted column PLUS the two
    // Vault references. Complete on purpose — if the raw row were missing the
    // allowlisted columns, dropping `select` would fail this suite on a missing
    // property instead of on the leak, and AC-4 would still not be the thing
    // under test.
    for (const column of Object.keys(bankConnectionExportSelect)) {
      row[column] ??= `${model}-${column}`;
    }
    row.accessTokenSecretId = "vault-access-ref";
    row.refreshTokenSecretId = "vault-refresh-ref";
  }
  return row;
}

function fakeClient(): ExtendedPrismaClient {
  return new Proxy(
    {},
    {
      get: (_target, model: string) => ({
        findMany: async ({
          where,
          select,
        }: {
          where: { userId: string };
          select?: Record<string, boolean>;
        }) => {
          const row = rawRow(model, where.userId);
          if (!select) return [row];
          // Project like Prisma does: only the keys explicitly set true.
          const projected: Record<string, unknown> = {};
          for (const [key, wanted] of Object.entries(select)) {
            if (wanted) projected[key] = row[key] ?? `${model}-${key}`;
          }
          return [projected];
        },
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
      const payload = parsed[node.key];
      expect(payload, `node ${node.key} missing`).toBeDefined();
      expect(payload!.rows).toHaveLength(1);
      expect(payload!.rows[0]!.userId).toBe(USER_A);
    }
  });

  it("serialises a Decimal column as an exact decimal STRING, never an object", async () => {
    const { raw } = await exportDocument();
    const parsed = JSON.parse(raw) as Record<string, { rows: { cashBalance: unknown }[] }>;
    const accounts = parsed.accounts;
    expect(accounts, "accounts node missing").toBeDefined();
    // Strings, not numbers — decimal.js ships `toJSON`, which JSON.stringify
    // applies before any replacer could intervene. Exactness over float
    // round-tripping is the deliberate choice for a portability artefact;
    // see the header of settings.export.ts and docs/exports/schema-v1.json.
    expect(accounts!.rows[0]!.cashBalance).toBe("1234.56");
    expect(raw).not.toContain(`"cashBalance":{`);
  });

  it("reads bank_connections through the select allowlist and leaks no vault reference", async () => {
    const { raw } = await exportDocument();
    const parsed = JSON.parse(raw) as Record<string, { rows: Record<string, unknown>[] }>;
    const connections = parsed.bank_connections;
    expect(connections, "bank_connections node missing").toBeDefined();

    const row = connections!.rows[0]!;
    // The projection actually happened: every allowlisted column is present…
    for (const column of Object.keys(bankConnectionExportSelect)) {
      expect(row, `bank_connections dropped the allowlisted column ${column}`).toHaveProperty(
        column,
      );
    }
    // …and the two Vault references the raw row carries are gone. The fixture
    // DOES return them when `select` is omitted, so removing the allowlist
    // from settings.export.ts turns this red (AC-4).
    expect(Object.keys(row)).not.toContain("accessTokenSecretId");
    expect(Object.keys(row)).not.toContain("refreshTokenSecretId");
    expect(raw).not.toContain("vault-access-ref");
    expect(raw).not.toContain("vault-refresh-ref");
    expect(raw).not.toContain("accessTokenSecretId");
    expect(raw).not.toContain("refreshTokenSecretId");
  });

  it("emits an empty rows array rather than the bare token undefined", async () => {
    // Guards the string-concatenation shape: `JSON.stringify(undefined)` is the
    // literal `undefined`, which would make the whole document unparseable.
    const emptyClient = new Proxy(
      {},
      { get: () => ({ findMany: async () => undefined }) },
    ) as unknown as ExtendedPrismaClient;
    const raw = (
      await collect(
        streamUserDataExport(emptyClient, { userId: USER_A, email: null }, GENERATED_AT),
      )
    ).join("");
    expect(raw).not.toContain("undefined");
    const parsed = JSON.parse(raw) as Record<string, { rows: unknown[] }>;
    for (const node of EXPORT_NODES) {
      expect(parsed[node.key]!.rows, `node ${node.key}`).toEqual([]);
    }
    expect((parsed as unknown as { identity: { email: null } }).identity.email).toBeNull();
  });
});

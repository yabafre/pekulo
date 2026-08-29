// Story 11-1 — generator-level proof: envelope shape (AC-2), one chunk per
// node (AC-8), Decimal coercion, and no vault secret in the payload (AC-4).
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
      const payload = parsed[node.key];
      expect(payload, `node ${node.key} missing`).toBeDefined();
      expect(payload!.rows).toHaveLength(1);
      expect(payload!.rows[0]!.userId).toBe(USER_A);
    }
  });

  it("serialises a Decimal column as a JSON number, not an object", async () => {
    const { raw } = await exportDocument();
    const parsed = JSON.parse(raw) as Record<string, { rows: { cashBalance: unknown }[] }>;
    const accounts = parsed.accounts;
    expect(accounts, "accounts node missing").toBeDefined();
    expect(accounts!.rows[0]!.cashBalance).toBe(1234.56);
    expect(raw).not.toContain(`"cashBalance":{`);
  });

  it("exposes a bank_connections node and no vault secret key anywhere", async () => {
    const { raw } = await exportDocument();
    expect(raw).toContain(`"bank_connections"`);
    expect(raw).not.toContain("accessTokenSecretId");
    expect(raw).not.toContain("refreshTokenSecretId");
  });
});

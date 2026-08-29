// Story 11-1, AC-1 — "the downloaded file validates against
// docs/exports/schema-v1.json".
//
// Added in aped-review of 11-1. The suite previously validated only against the
// Zod mirror in @pekulo/validators, which is strictly weaker: its node object is
// non-strict (an extra property passes) and its `.catchall()` puts no constraint
// on node-key shape. NFR-30 names the JSON Schema as the published artefact, so
// the artefact itself is what an acceptance test has to exercise — against a
// document the real generator produced, not a hand-written fixture.
//
// The second half of this file is what keeps the first half honest: a schema
// that accepts everything would pass the happy path silently. Each rejection
// case pins one constraint the published schema is supposed to enforce.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { Prisma } from "@generated/prisma/client";
import type { ExtendedPrismaClient } from "../../database";
import { EXPORT_NODES, streamUserDataExport } from "./settings.export";

const SCHEMA_PATH = `${import.meta.dir}/../../../../../docs/exports/schema-v1.json`;
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }));
const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));

function clientWith(rowsPerNode: (model: string) => unknown[]): ExtendedPrismaClient {
  return new Proxy(
    {},
    { get: (_t, model: string) => ({ findMany: async () => rowsPerNode(model) }) },
  ) as unknown as ExtendedPrismaClient;
}

async function documentFrom(client: ExtendedPrismaClient, email: string | null = null) {
  const chunks: string[] = [];
  for await (const chunk of streamUserDataExport(client, { userId: USER_A, email })) {
    chunks.push(chunk);
  }
  return JSON.parse(chunks.join("")) as Record<string, unknown>;
}

function errors(): string {
  return JSON.stringify(validate.errors ?? [], null, 2);
}

describe("published export schema (story 11-1, AC-1)", () => {
  it("accepts a document produced by the real generator, fully populated", async () => {
    const document = await documentFrom(
      clientWith((model) => [
        {
          id: `${model}-1`,
          userId: USER_A,
          amount: new Prisma.Decimal("1234.56"),
          createdAt: new Date("2026-08-29T10:00:00.000Z"),
        },
      ]),
      "a@pekulo.local",
    );
    expect(validate(document), errors()).toBe(true);
  });

  it("accepts a brand-new user who owns no row in any of the 21 tables", async () => {
    const document = await documentFrom(clientWith(() => []));
    expect(validate(document), errors()).toBe(true);
    for (const node of EXPORT_NODES) {
      expect((document[node.key] as { rows: unknown[] }).rows, `node ${node.key}`).toEqual([]);
    }
  });

  it("accepts a null email — identity.email is nullable by design", async () => {
    const document = await documentFrom(
      clientWith(() => []),
      null,
    );
    expect(validate(document), errors()).toBe(true);
  });

  // --- the schema must actually reject things ------------------------------

  async function baseline(): Promise<Record<string, unknown>> {
    return documentFrom(
      clientWith(() => [{ id: "x", userId: USER_A }]),
      "a@pekulo.local",
    );
  }

  it("rejects a node missing its schema_version", async () => {
    const document = await baseline();
    delete (document.kpis as Record<string, unknown>).schema_version;
    expect(validate(document)).toBe(false);
  });

  it("rejects a node whose rows is not an array", async () => {
    const document = await baseline();
    (document.kpis as Record<string, unknown>).rows = "not-an-array";
    expect(validate(document)).toBe(false);
  });

  it("rejects a node carrying an unexpected property", async () => {
    const document = await baseline();
    (document.kpis as Record<string, unknown>).surprise = true;
    expect(validate(document)).toBe(false);
  });

  it("rejects a top-level key that is not snake_case", async () => {
    // Tightened in review: the original pattern was `[a-z_]+` under
    // `additionalProperties: true`, so a key carrying a digit or an uppercase
    // letter matched nothing and fell through unvalidated — a malformed
    // `realEstateV2` node would have been accepted wholesale.
    const document = await baseline();
    document.realEstateV2 = { nonsense: 1 };
    expect(validate(document)).toBe(false);
  });

  it("rejects a non-uuid user_id", async () => {
    const document = await baseline();
    (document.identity as Record<string, unknown>).user_id = "not-a-uuid";
    expect(validate(document)).toBe(false);
  });

  it("rejects a generated_at that is not a date-time", async () => {
    const document = await baseline();
    document.generated_at = "yesterday";
    expect(validate(document)).toBe(false);
  });

  it("rejects a schema_version other than 1.0.0", async () => {
    const document = await baseline();
    document.schema_version = "2.0.0";
    expect(validate(document)).toBe(false);
  });
});

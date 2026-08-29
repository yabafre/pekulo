// Story 11-1, AC-5 (verbatim from story 11-1-data-export:19):
//   Given a database table that holds user data but was never added to the
//   export, When the apps/api test suite runs, Then it fails and names that
//   table. Given a new column on the bank-connection table, When the suite
//   runs, Then it fails until that column has been explicitly classified as
//   either exportable user data or a secret — a new column can never reach
//   the export, or be dropped from it, unnoticed.
//
// The 2026-06-05 lesson in miniature: every place that ENUMERATES the model
// set drifts the moment a migration lands. The prefix registry closed that
// class with a DMMF meta-test (database/id-prefixes.config.test.ts) — this is
// the same guard for the export map, plus the reverse guard on the
// BankConnection select allowlist.
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

  // ---------------------------------------------------------------------
  // Widened in aped-review of story 11-1. The two guards below close holes
  // the original pair left open:
  //   - only BankConnection was screened for secrets; the other 20 nodes do a
  //     bare findMany, so a secret column landing on any of them would enter
  //     the export with the suite still green;
  //   - "user-scoped" was inferred from a field LITERALLY named `userId`, so a
  //     future table keyed by `ownerId` (or scoped only through a parent
  //     relation) would escape the export unnoticed — the very drift class the
  //     2026-06-05 lesson exists to close.
  // ---------------------------------------------------------------------

  // Scalar names that read like a credential. Deliberately broad: a false
  // positive costs one line in the allowlist below, a false negative exports a
  // secret.
  const SECRET_NAME_PATTERN =
    /token|secret|password|credential|api_?key|hash|salt|vault|private_?key|cipher/i;

  // Reviewed field-by-field and cleared for export. `<Model>.<field>`.
  // Adding a line here is a deliberate act: state WHY the column is user data.
  const SECRET_NAME_ALLOWLIST = new Set<string>([
    // Hash of the transaction label the user already owns — their own data,
    // used to dedupe LLM calls. No credential value.
    "LlmCallLog.labelHash",
  ]);

  // Models that hold no user data and are therefore rightly absent from the
  // export. Global reference caches keyed naturally, no user_id, no FK to
  // auth.users (architecture.md § Reference caches).
  const NON_USER_MODELS = new Set<string>(["MerchantLogoCache", "ProviderLogoCache"]);

  it("exports no scalar whose name reads like a credential", () => {
    const exported = new Set(EXPORT_NODES.map((node) => node.model));
    const offenders: string[] = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      if (!exported.has(model.name)) continue;
      for (const field of model.fields) {
        if (field.kind !== "scalar") continue;
        const qualified = `${model.name}.${field.name}`;
        if (!SECRET_NAME_PATTERN.test(field.name)) continue;
        if (SECRET_NAME_ALLOWLIST.has(qualified)) continue;
        // BankConnection's two vault columns are handled by the select
        // allowlist above — they never reach the payload.
        if (
          model.name === "BankConnection" &&
          (BANK_CONNECTION_SECRET_FIELDS as readonly string[]).includes(field.name)
        ) {
          continue;
        }
        offenders.push(qualified);
      }
    }
    expect(
      offenders,
      `column(s) whose name reads like a credential would be exported verbatim. ` +
        `Either exclude them behind an explicit \`select\` allowlist (as ` +
        `bankConnectionExportSelect does), or — if the column really is the ` +
        `user's own data — add it to SECRET_NAME_ALLOWLIST with a one-line ` +
        `justification: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("accounts for every Prisma model as either exported or explicitly non-user", () => {
    const exported = new Set(EXPORT_NODES.map((node) => node.model));
    const unaccounted = Prisma.dmmf.datamodel.models
      .map((model) => model.name)
      .filter((name) => !exported.has(name) && !NON_USER_MODELS.has(name));
    expect(
      unaccounted,
      `model(s) are neither in EXPORT_NODES nor declared non-user. The userId ` +
        `guard above only sees a field literally named \`userId\`, so a table ` +
        `scoped by another column (ownerId, or a parent relation) slips past it ` +
        `— which is exactly how a GDPR export goes quietly incomplete. Add the ` +
        `model to EXPORT_NODES, or to NON_USER_MODELS with its rationale: ` +
        `${unaccounted.join(", ")}`,
    ).toEqual([]);
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

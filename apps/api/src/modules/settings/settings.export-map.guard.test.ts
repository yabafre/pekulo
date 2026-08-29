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

  it("never selects a vault secret reference", () => {
    for (const secret of BANK_CONNECTION_SECRET_FIELDS) {
      expect(
        Object.keys(bankConnectionExportSelect),
        `${secret} must never be exported (AC-4)`,
      ).not.toContain(secret);
    }
  });
});

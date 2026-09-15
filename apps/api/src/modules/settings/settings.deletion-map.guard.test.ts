// Story 11-2, AC-4 (verbatim from story 11-2-account-deletion:17):
//   Given a database table that holds user data but was never added to the
//   deletion, When the apps/api test suite runs, Then it fails and names that
//   table. And given a table the export takes but the deletion leaves behind —
//   or the reverse — When the suite runs, Then it fails and names it: what a
//   user can take with them and what goes when they leave are asserted to be
//   the same set, so a new table can never enter one without the other.
//
// This is the guard story 11-1's review asked for by name: "the deletion
// cascade needs the same mechanical guard, not a prose reminder". The
// set-equality assertion is the cheap part that does the most work — it means
// the NEXT table only has to be remembered ONCE, in either list, and the build
// names the other one.
import { describe, expect, it } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { EXPORT_NODES } from "./settings.export";
import { DELETION_NODES } from "./settings.deletion";

// Kept in sync with settings.export-map.guard.test.ts by the set-equality test
// below: a model declared non-user there and exported here (or the reverse)
// cannot happen, because the two node lists must hold the same models.
const NON_USER_MODELS = new Set<string>(["MerchantLogoCache", "ProviderLogoCache"]);

function modelsWithUserId(): string[] {
  return Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === "userId"))
    .map((model) => model.name);
}

describe("settings deletion map (story 11-2)", () => {
  it("covers every Prisma model that carries a userId field", () => {
    const registered = new Set(DELETION_NODES.map((node) => node.model));
    const missing = modelsWithUserId().filter((name) => !registered.has(name));
    expect(
      missing,
      `Prisma model(s) hold user data but are absent from DELETION_NODES in ` +
        `apps/api/src/modules/settings/settings.deletion.ts — a GDPR erasure ` +
        `that leaves them behind is incomplete (FR-50). Add a node: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("registers no model that Prisma does not know", () => {
    const known = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
    const unknown = DELETION_NODES.map((node) => node.model).filter((name) => !known.has(name));
    expect(unknown, `DELETION_NODES references unknown model(s): ${unknown.join(", ")}`).toEqual(
      [],
    );
  });

  it("uses a unique key per node", () => {
    const keys = DELETION_NODES.map((node) => node.key);
    expect(new Set(keys).size, "duplicate key in DELETION_NODES").toBe(keys.length);
  });

  it("deletes exactly the models the export exports", () => {
    const exported = [...new Set(EXPORT_NODES.map((n) => n.model))].sort();
    const deleted = [...new Set(DELETION_NODES.map((n) => n.model))].sort();
    expect(
      deleted,
      `EXPORT_NODES and DELETION_NODES have drifted. They are two views of one ` +
        `answer to "what is my data": everything the user can take with them ` +
        `must be everything that goes when they leave. Add the missing model to ` +
        `whichever list lacks it — never silence this test.`,
    ).toEqual(exported);
  });

  it("accounts for every Prisma model as either deleted or explicitly non-user", () => {
    const deleted = new Set(DELETION_NODES.map((node) => node.model));
    const unaccounted = Prisma.dmmf.datamodel.models
      .map((model) => model.name)
      .filter((name) => !deleted.has(name) && !NON_USER_MODELS.has(name));
    expect(
      unaccounted,
      `model(s) are neither in DELETION_NODES nor declared non-user. The userId ` +
        `guard above only sees a field literally named \`userId\`, so a table ` +
        `scoped by another column slips past it — which is how an erasure goes ` +
        `quietly incomplete: ${unaccounted.join(", ")}`,
    ).toEqual([]);
  });

  it("orders children before their parents", () => {
    // A deleteMany on a parent cascades to children that declare ON DELETE
    // CASCADE, so a parent-first order is not WRONG — but it makes the counts
    // this method returns meaningless (the child reports 0 because the parent
    // already took its rows). Child-first keeps every count truthful, which is
    // what AC-1 asserts against.
    const position = new Map(DELETION_NODES.map((node, index) => [node.model, index]));
    const CHILD_BEFORE_PARENT: ReadonlyArray<readonly [string, string]> = [
      ["HoldingLot", "Holding"],
      ["Holding", "Account"],
      ["AccountBalanceLog", "Account"],
      ["Transaction", "Account"],
      ["RealEstateValuation", "RealEstate"],
      ["RealEstateMortgage", "RealEstate"],
      ["RealEstateRental", "RealEstate"],
    ];
    for (const [child, parent] of CHILD_BEFORE_PARENT) {
      expect(
        position.get(child)!,
        `${child} must be deleted before ${parent} so its row count stays truthful`,
      ).toBeLessThan(position.get(parent)!);
    }
  });
});

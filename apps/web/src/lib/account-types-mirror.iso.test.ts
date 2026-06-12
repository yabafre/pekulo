// Drift guard for the ACCOUNT_TYPES literal duplicated across packages.
//
// @pekulo/types#ACCOUNT_TYPES is the cross-app source of truth (L1). It is
// re-declared inline as ACCOUNT_TYPES_MIRROR inside
// @pekulo/validators/src/accounts/accounts.schemas.ts because validators
// cannot import from types (the types → validators Turbo edge already exists
// for Account / Compass / Milestone re-exports, and the reverse edge would
// be a cycle). The historical guard-rail was "drift caught at code review";
// this test makes the invariant machine-enforced.
//
// ACCOUNT_TYPES_MIRROR is not exported, so we read it back through the Zod
// schema that consumes it: z.enum(ACCOUNT_TYPES_MIRROR).options is the exact
// runtime literal. Asserting deep equality covers BOTH the set of values AND
// their order (z.enum preserves declaration order).

import { ACCOUNT_TYPES } from "@pekulo/types";
import { accountSchema } from "@pekulo/validators";
import { describe, expect, it } from "vitest";

describe("ACCOUNT_TYPES mirror (@pekulo/types ↔ @pekulo/validators)", () => {
  // accountSchema.type is z.enum(ACCOUNT_TYPES_MIRROR); .options is the
  // literal tuple the validators package actually enforces at runtime.
  const validatorsMirror = accountSchema.shape.type.options;

  it("validators mirror equals the @pekulo/types source of truth (values + order)", () => {
    expect(validatorsMirror).toEqual([...ACCOUNT_TYPES]);
  });

  it("the two literals describe the same set (order-independent safety net)", () => {
    expect([...validatorsMirror].sort()).toEqual([...ACCOUNT_TYPES].sort());
  });
});

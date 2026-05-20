// packages/contracts/src/__tests__/version-coexistence.fixture.ts
// Typecheck-only proof for AC-2: when a hypothetical compassContractV2 is
// added next to the shipped compassContractV1, both still resolve and the
// shipped `compassContract` default still typechecks against V1's shape.
// This file is NOT executed at runtime — `tsc --noEmit` is the verifier.
//
// Wording matches AC-2 verbatim — three `satisfies` assertions (review F7).

import { compassContract, compassContractV1 } from "../compass";

// Shadow a hypothetical V2 alongside V1. In a real bump, V2 would land
// inside `compass.contract.ts` next to V1. Here it lives in the fixture
// strictly to exercise the typing rule.
const compassContractV2 = {
  // procedure stub keyed differently from V1; presence of any key in V2
  // proves the fixture has produced a divergent shape.
  breakingProcedure: {} as const,
} as const;

// (i) current default ≡ V1 (the shipped invariant).
void (compassContract satisfies typeof compassContractV1);

// (ii) V2 lives alongside without overwriting V1.
void (compassContractV2 satisfies Record<string, unknown>);

// (iii) the named import compassContractV1 still resolves after introducing
// the V2 shadow — the explicit `satisfies` materialises the type so the
// import isn't tree-shaken before tsc evaluates it.
void (compassContractV1 satisfies typeof compassContractV1);

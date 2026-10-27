// AC-8 (verbatim from story 12-1-advisory-access-gate):
//   AC-8 (owner operations) — Given an owner configured in the environment, When
//   they call status, list, grant or ban, Then the calls succeed; an active non-owner
//   calling list, grant or ban gets 403; granting or banning an owner returns 400
//   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
//   the owner from the JWT, never a client-supplied value.

import { describe, expect, test } from "bun:test";
import {
  advisoryContract,
  advisoryContractMeta,
  advisoryContractV1,
  pekuloContract,
} from "@pekulo/contracts";

describe("advisory contract", () => {
  test("exposes status, snapshot, grant, ban, list procedures", () => {
    expect(advisoryContract).toHaveProperty("status");
    expect(advisoryContract).toHaveProperty("snapshot");
    expect(advisoryContract).toHaveProperty("grant");
    expect(advisoryContract).toHaveProperty("ban");
    expect(advisoryContract).toHaveProperty("list");
  });

  test("advisoryContract is alias of advisoryContractV1", () => {
    expect(advisoryContract).toBe(advisoryContractV1);
  });

  test("advisoryContractMeta provides moduleKey and mountPath", () => {
    expect(advisoryContractMeta).toEqual({
      moduleKey: "advisory",
      mountPath: "/rpc/v1/advisory",
      version: "v1",
    });
  });

  test("pekuloContract includes advisory contract", () => {
    expect(pekuloContract).toHaveProperty("advisory");
    expect(pekuloContract.advisory).toBe(advisoryContract);
  });
});

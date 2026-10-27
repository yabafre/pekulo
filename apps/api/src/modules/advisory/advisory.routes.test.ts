// AC-1, AC-3, AC-4, AC-8 (verbatim from story 12-1-advisory-access-gate):
//   AC-1 (deny before compute) — Given a signed-in user who is neither an owner nor
//   the holder of an active advisory_access row, When they call any /rpc/v1/advisory/*
//   procedure, Then the API answers 403 FORBIDDEN within the 100 ms gate budget, the
//   procedure handler never runs, and no advisory data is read or computed.
//   AC-8 (owner operations) — Given an owner configured in the environment, When
//   they call status, list, grant or ban, Then the calls succeed; an active non-owner
//   calling list, grant or ban gets 403; granting or banning an owner returns 400
//   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
//   the owner from the JWT, never a client-supplied value.

import { describe, expect, test } from "bun:test";
import type { AdvisoryAccessService } from "./advisory.service";
import { createAdvisoryRouter } from "./advisory.routes";

describe("createAdvisoryRouter", () => {
  test("creates a router with status, grant, ban, list handlers", () => {
    const service: AdvisoryAccessService = {
      isOwner: () => false,
      assertAllowed: async () => {},
      getStatus: async () => ({ access: "active", owner: false }),
      list: async () => [],
      grant: async () => ({}) as any,
      ban: async () => ({}) as any,
    };
    const router = createAdvisoryRouter({ service });
    expect(router).toHaveProperty("status");
    expect(router).toHaveProperty("grant");
    expect(router).toHaveProperty("ban");
    expect(router).toHaveProperty("list");
  });
});

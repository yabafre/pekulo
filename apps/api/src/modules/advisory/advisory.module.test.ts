// AC-1, AC-8 (verbatim from story 12-1-advisory-access-gate):
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
import type { PrismaService } from "../../database";
import { createAdvisoryModule } from "./advisory.module";

describe("createAdvisoryModule", () => {
  test("wires repository, service, router with owner set", () => {
    const prismaService = {
      client: {
        advisoryAccess: {},
      },
    } as unknown as PrismaService;
    const mod = createAdvisoryModule({
      prismaService,
      ownerUserIds: new Set(["owner-1"]),
    });
    expect(mod).toHaveProperty("service");
    expect(mod).toHaveProperty("router");
    expect(mod.service.isOwner("owner-1")).toBe(true);
    expect(mod.service.isOwner("other")).toBe(false);
  });
});

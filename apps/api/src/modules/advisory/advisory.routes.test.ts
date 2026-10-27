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

// AC-4 (verbatim from story 12-2-advisory-analysis-engine:20):
//   Given a caller who is neither an owner nor an active allowlisted user, When they
//   request the snapshot, Then the API answers 403 `FORBIDDEN` before any accounts,
//   holdings, equity, compass or monthly read and before any engine computation runs;
//   an active allowlisted caller receives 200.

import { describe, expect, test } from "bun:test";
import { createRouterClient } from "@orpc/server";
import { PekuloError } from "../../common/errors";
import { advisorySnapshotFixture } from "./advisory.test-fixtures";
import type { AdvisoryAccessService } from "./advisory.service";
import type { AdvisoryAnalysisService } from "./advisory-analysis.service";
import { createAdvisoryRouter } from "./advisory.routes";

function service(over: Partial<AdvisoryAccessService> = {}): AdvisoryAccessService {
  return {
    isOwner: () => false,
    assertAllowed: async () => {},
    getStatus: async () => ({ access: "active", owner: false }),
    list: async () => [],
    grant: async () => ({}) as any,
    ban: async () => ({}) as any,
    ...over,
  };
}

function analysis(over: Partial<AdvisoryAnalysisService> = {}): AdvisoryAnalysisService {
  return {
    getSnapshot: async () => advisorySnapshotFixture(),
    ...over,
  };
}

describe("createAdvisoryRouter", () => {
  test("creates a router with status, snapshot, grant, ban and list handlers", () => {
    const router = createAdvisoryRouter({ service: service(), analysis: analysis() });

    expect(router).toHaveProperty("status");
    expect(router).toHaveProperty("snapshot");
    expect(router).toHaveProperty("grant");
    expect(router).toHaveProperty("ban");
    expect(router).toHaveProperty("list");
  });

  test("status handler invokes getStatus for allowlisted user", async () => {
    const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
    const client = createRouterClient(router, { context: { userId: "user-1", email: null } });

    const status = await client.status();

    expect(status).toEqual({ access: "active", owner: false });
  });

  test("snapshot handler returns the analysis snapshot for an allowlisted user", async () => {
    const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
    const client = createRouterClient(router, { context: { userId: "user-1", email: null } });

    const snapshot = await client.snapshot();

    expect(snapshot).toEqual(advisorySnapshotFixture());
  });

  test("middleware rejects missing user context with typed UNAUTHORIZED (401)", async () => {
    const router = createAdvisoryRouter({ service: service(), analysis: analysis() });
    const client = createRouterClient(router, { context: { userId: "", email: null } });
    let error: any;
    try {
      await client.status();
    } catch (err) {
      error = err;
    }

    expect(error?.code).toBe("UNAUTHORIZED");
    expect(error?.status).toBe(401);
  });

  test("middleware maps PekuloError FORBIDDEN to typed contract FORBIDDEN (403)", async () => {
    const router = createAdvisoryRouter({
      service: service({
        assertAllowed: async () => {
          throw new PekuloError("FORBIDDEN", "restricted access");
        },
      }),
      analysis: analysis(),
    });
    const client = createRouterClient(router, { context: { userId: "user-1", email: null } });
    let error: any;
    try {
      await client.status();
    } catch (err) {
      error = err;
    }

    expect(error?.code).toBe("FORBIDDEN");
    expect(error?.status).toBe(403);
  });

  test("AC-4 — the snapshot gate rejects before the analysis engine runs", async () => {
    let engineCalls = 0;
    const router = createAdvisoryRouter({
      service: service({
        assertAllowed: async () => {
          throw new PekuloError("FORBIDDEN", "restricted access");
        },
      }),
      analysis: analysis({
        getSnapshot: async () => {
          engineCalls += 1;
          return advisorySnapshotFixture();
        },
      }),
    });
    const client = createRouterClient(router, { context: { userId: "user-1", email: null } });
    let error: any;
    try {
      await client.snapshot();
    } catch (err) {
      error = err;
    }

    expect(error?.code).toBe("FORBIDDEN");
    expect(error?.status).toBe(403);
    expect(engineCalls).toBe(0);
  });
});

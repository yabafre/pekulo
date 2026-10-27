// AC-1 + AC-7 (verbatim from story 12-1-advisory-access-gate):
//   AC-1 (deny before compute) — Given a signed-in user who is neither an owner nor
//   the holder of an active advisory_access row, When they call any /rpc/v1/advisory/*
//   procedure, Then the API answers 403 FORBIDDEN within the 100 ms gate budget, the
//   procedure handler never runs, and no advisory data is read or computed.
//   AC-7 (platform guard) — Given the access-decision guard, When its injected reader
//   returns active, banned or no record, Then it resolves only for active and
//   otherwise raises the platform's 403 forbidden error; it depends on the injected
//   reader and the platform layer does not import feature modules.

import { describe, expect, test } from "bun:test";
import { PekuloError } from "../../common/errors";
import { requireAdvisoryAccess, type AdvisoryAccessReader } from "./advisory-access-guard";

function reader(status: "active" | "banned" | null): AdvisoryAccessReader {
  return { getAccessStatus: async () => status };
}

describe("requireAdvisoryAccess", () => {
  test("AC-2 — an active row resolves", async () => {
    await expect(requireAdvisoryAccess(reader("active"), "u1")).resolves.toBeUndefined();
  });

  test("AC-1 — a user with no row is FORBIDDEN", async () => {
    const error = await requireAdvisoryAccess(reader(null), "u1").catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(PekuloError);
    expect((error as PekuloError).code).toBe("FORBIDDEN");
  });

  test("AC-3 — a banned row is FORBIDDEN", async () => {
    const error = await requireAdvisoryAccess(reader("banned"), "u1").catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(PekuloError);
    expect((error as PekuloError).code).toBe("FORBIDDEN");
  });
});

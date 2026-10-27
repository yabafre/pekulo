// AC-8 (verbatim from story 12-1-advisory-access-gate):
//   AC-8 (owner operations) — Given an owner configured in the environment, When
//   they call status, list, grant or ban, Then the calls succeed; an active non-owner
//   calling list, grant or ban gets 403; granting or banning an owner returns 400
//   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
//   the owner from the JWT, never a client-supplied value.

import { describe, expect, test } from "bun:test";
import { ConfigError } from "./env";
import { parseAdvisoryOwnerUserIds } from "./advisory-owner-ids";

const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("parseAdvisoryOwnerUserIds", () => {
  test("unset and empty values lock the owner set down", () => {
    expect(parseAdvisoryOwnerUserIds(undefined).size).toBe(0);
    expect(parseAdvisoryOwnerUserIds("   ").size).toBe(0);
  });

  test("parses, trims, lowercases and de-duplicates comma-separated IDs", () => {
    const result = parseAdvisoryOwnerUserIds(`${OWNER_A.toUpperCase()} , ${OWNER_A} ,`);
    expect([...result]).toEqual([OWNER_A]);
  });

  test("a malformed ID fails boot with a named field", () => {
    let error: unknown;
    try {
      parseAdvisoryOwnerUserIds("not-a-uuid");
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).fieldErrors.ADVISORY_OWNER_USER_IDS?.[0]).toContain("not-a-uuid");
  });
});

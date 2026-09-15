import { describe, expect, test } from "bun:test";
import { hashUserId, USER_ID_HASH_LENGTH } from "./hash-user-id";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("hashUserId", () => {
  test("is stable, fixed-length hex, and never contains the raw id", () => {
    const h = hashUserId(USER_A);
    expect(h).toBe(hashUserId(USER_A));
    expect(h).toMatch(new RegExp(`^[0-9a-f]{${USER_ID_HASH_LENGTH}}$`));
    expect(h).not.toContain(USER_A);
    expect(USER_A).not.toContain(h);
  });

  test("distinguishes two users", () => {
    expect(hashUserId(USER_A)).not.toBe(hashUserId("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
  });
});

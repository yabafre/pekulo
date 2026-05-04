import { describe, expect, test } from "bun:test";
import type { JwtVerifier } from "./jwt-verifier";
import { requireUserContext } from "./require-user-context";

function fakeVerifier(behaviour: "ok" | "throw"): JwtVerifier {
  return {
    verify: async (_token: string) => {
      if (behaviour === "throw") throw new Error("simulated verify failure");
      return {
        sub: "11111111-1111-1111-1111-111111111111",
        email: "alex@pekulo.app",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
    },
  };
}

describe("requireUserContext", () => {
  test("missing header throws UNAUTHORIZED", async () => {
    const headers = new Headers();
    await expect(requireUserContext(headers, fakeVerifier("ok"))).rejects.toMatchObject({
      name: "PekuloError",
      code: "UNAUTHORIZED",
    });
  });

  test("malformed scheme throws UNAUTHORIZED", async () => {
    const headers = new Headers({ authorization: "not-a-bearer xyz" });
    await expect(requireUserContext(headers, fakeVerifier("ok"))).rejects.toMatchObject({
      name: "PekuloError",
      code: "UNAUTHORIZED",
    });
  });

  test("invalid token (verifier throws) → UNAUTHORIZED", async () => {
    const headers = new Headers({ authorization: "Bearer eyInvalid" });
    await expect(requireUserContext(headers, fakeVerifier("throw"))).rejects.toMatchObject({
      name: "PekuloError",
      code: "UNAUTHORIZED",
    });
  });

  test("valid token resolves to { userId, email }", async () => {
    const headers = new Headers({ authorization: "Bearer eyValidStub" });
    const ctx = await requireUserContext(headers, fakeVerifier("ok"));
    expect(ctx.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(ctx.email).toBe("alex@pekulo.app");
  });
});

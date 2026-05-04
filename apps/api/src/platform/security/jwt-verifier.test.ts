// Cover 6 branches: valid, expired, wrong secret, malformed, wrong issuer, wrong audience.
import { describe, expect, test } from "bun:test";
import { SignJWT } from "jose";
import { createJwtVerifier } from "./jwt-verifier";

const SECRET = "test-secret-at-least-32-chars-long-aaaa";
const WRONG_SECRET = "different-secret-also-32-chars-long-bbbb";
const ISSUER = "https://stub.supabase.co/auth/v1";
const AUDIENCE = "authenticated";

async function sign(
  claims: Record<string, unknown>,
  secret: string,
  expSeconds: number,
  options: { issuer?: string; audience?: string } = {},
) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(claims.sub ?? "user-uuid"))
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
    .sign(new TextEncoder().encode(secret));
}

describe("jwt-verifier", () => {
  test("valid HS256 token resolves to { sub, email, exp }", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const token = await sign(
      { sub: "11111111-1111-1111-1111-111111111111", email: "alex@pekulo.app" },
      SECRET,
      3600,
    );
    const payload = await verifier.verify(token);
    expect(payload.sub).toBe("11111111-1111-1111-1111-111111111111");
    expect(payload.email).toBe("alex@pekulo.app");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test("expired token rejects", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const token = await sign({ sub: "u" }, SECRET, -3600);
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  test("wrong secret rejects", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const token = await sign({ sub: "u" }, WRONG_SECRET, 3600);
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  test("malformed token rejects", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow();
  });

  test("wrong issuer rejects", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const token = await sign({ sub: "u" }, SECRET, 3600, {
      issuer: "https://other.supabase.co/auth/v1",
    });
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  test("wrong audience rejects", async () => {
    const verifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const token = await sign({ sub: "u" }, SECRET, 3600, { audience: "service_role" });
    await expect(verifier.verify(token)).rejects.toThrow();
  });
});

// apps/api/src/platform/security/jwt-verifier.ts
// HS256 JWT verifier wrapping `jose.jwtVerify`. Used by `requireUserContext`
// to validate Supabase access tokens forwarded over oRPC. Asymmetric (RS256
// / ES256 / JWKS) verification deferred to (b) public-ramp ; HS256 + shared
// secret matches Supabase Docker local + Supabase legacy projects.

import { jwtVerify } from "jose";

export interface VerifiedJwtPayload {
  sub: string;
  email: string | null;
  exp: number;
}

export interface JwtVerifier {
  verify(token: string): Promise<VerifiedJwtPayload>;
}

export function createJwtVerifier(input: { secret: string }): JwtVerifier {
  const key = new TextEncoder().encode(input.secret);
  return {
    async verify(token: string): Promise<VerifiedJwtPayload> {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new Error("jwt.sub missing or empty");
      }
      if (typeof payload.exp !== "number") {
        throw new Error("jwt.exp missing");
      }
      const email = typeof payload.email === "string" ? payload.email : null;
      return { sub: payload.sub, email, exp: payload.exp };
    },
  };
}

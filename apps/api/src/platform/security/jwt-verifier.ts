// apps/api/src/platform/security/jwt-verifier.ts
// JWT verifier wrapping `jose.jwtVerify`. Used by `requireUserContext` to
// validate Supabase access tokens forwarded over oRPC.
//
// Two modes are supported:
//   - HS256 (legacy / Docker-local Supabase): shared secret, configured
//     via `secret`. Tests use this path with a deterministic secret.
//   - ES256 (modern Supabase, post-Sept 2024 default): asymmetric P-256
//     ECDSA, public keys fetched from the project's JWKS endpoint at
//     `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. `jose`'s
//     `createRemoteJWKSet` handles fetch + cache + key rollover.
//
// `iss` and `aud` are validated for ADR-0013 belt+suspenders — even if a
// signing key leaked between projects, tokens from a sibling Supabase
// project would carry a different issuer and be rejected.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface VerifiedJwtPayload {
  sub: string;
  email: string | null;
  exp: number;
}

export interface JwtVerifier {
  verify(token: string): Promise<VerifiedJwtPayload>;
}

export interface JwtVerifierInput {
  /** HS256 shared secret. Required for HS256 mode. */
  secret: string;
  /** Token issuer (`<SUPABASE_URL>/auth/v1`). */
  issuer: string;
  /** Audience claim — Supabase tokens use `"authenticated"`. */
  audience: string;
  /**
   * Supabase project URL — when provided, the verifier ALSO accepts ES256
   * tokens by fetching keys from `<supabaseUrl>/auth/v1/.well-known/jwks.json`.
   * Tokens still flow through the same `iss`/`aud` validation.
   */
  supabaseUrl?: string;
}

const ALGORITHMS = ["HS256", "ES256"] as const;

export function createJwtVerifier(input: JwtVerifierInput): JwtVerifier {
  const symmetricKey = new TextEncoder().encode(input.secret);
  const jwksGetKey: JWTVerifyGetKey | null = input.supabaseUrl
    ? createRemoteJWKSet(
        new URL(`${input.supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`),
      )
    : null;

  return {
    async verify(token: string): Promise<VerifiedJwtPayload> {
      // Peek the alg header without verification — single base64 decode of
      // the first segment is cheap and lets us route to the right key.
      // jose's algorithms list accepts both HS256 and ES256, but the key
      // material differs; route on the JWT header.
      const alg = peekAlg(token);

      let payload;
      if (alg === "ES256") {
        if (!jwksGetKey) {
          throw new Error("jwt.alg ES256 received but JWKS verifier not configured");
        }
        ({ payload } = await jwtVerify(token, jwksGetKey, {
          algorithms: ["ES256"],
          issuer: input.issuer,
          audience: input.audience,
        }));
      } else {
        ({ payload } = await jwtVerify(token, symmetricKey, {
          algorithms: ["HS256"],
          issuer: input.issuer,
          audience: input.audience,
        }));
      }

      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new Error("jwt.sub missing or empty");
      }
      const email = typeof payload.email === "string" ? payload.email : null;
      return { sub: payload.sub, email, exp: payload.exp ?? 0 };
    },
  };
}

/** Pull the `alg` from a JWT's protected header without verifying the signature. */
function peekAlg(token: string): (typeof ALGORITHMS)[number] | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const headerSegment = token.slice(0, dot);
  let json: string;
  try {
    json = Buffer.from(headerSegment, "base64url").toString("utf8");
  } catch {
    return null;
  }
  try {
    const header = JSON.parse(json) as { alg?: unknown };
    if (header.alg === "HS256" || header.alg === "ES256") return header.alg;
    return null;
  } catch {
    return null;
  }
}

// apps/api/src/platform/security/require-user-context.ts
// Single chokepoint mapping `Headers → { userId, email }` for the apps/api
// request path. Throws PekuloError("UNAUTHORIZED", ...) on every failure
// mode (missing header, malformed scheme, invalid token). The Elysia global
// .onError shapes the wire body via the error-mapper.

import { PekuloError } from "../../common/errors";
import type { JwtVerifier } from "./jwt-verifier";

export interface UserContext {
  userId: string;
  email: string | null;
}

export async function requireUserContext(
  headers: Headers,
  verifier: JwtVerifier,
): Promise<UserContext> {
  const auth = headers.get("authorization") ?? "";
  if (!auth) {
    throw new PekuloError("UNAUTHORIZED", "missing Authorization header");
  }
  if (!auth.startsWith("Bearer ")) {
    throw new PekuloError("UNAUTHORIZED", "Authorization header must use Bearer scheme");
  }
  const token = auth.slice("Bearer ".length).trim();
  if (token.length === 0) {
    throw new PekuloError("UNAUTHORIZED", "Bearer token is empty");
  }
  let payload;
  try {
    payload = await verifier.verify(token);
  } catch (err) {
    throw new PekuloError("UNAUTHORIZED", "invalid Bearer token", { cause: err });
  }
  return { userId: payload.sub, email: payload.email };
}

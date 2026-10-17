// apps/web/e2e/e2e-env.ts
// Shared E2E constants for the local disposable stack (story 11-4, AC-4).
// Deliberately mints the anon JWT at runtime via Node crypto so no literal
// `eyJ...` token appears in the repository (gitleaks-clean) and NEVER reads
// or constructs a service_role key under apps/web (AC-4).
import { createHmac } from "node:crypto";

export const E2E_WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:3002";
export const E2E_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const E2E_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const E2E_JWT_SECRET =
  process.env.E2E_JWT_SECRET ?? "local-e2e-jwt-secret-local-e2e-jwt-secret";

export const E2E_USER_EMAIL = "alex.axe.e2e@pekulo.test";
export const E2E_USER_PASSWORD = "PekuloAxeE2e!2026Password";

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function mintAnonJwt(secret: string = E2E_JWT_SECRET): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      role: "anon",
      iss: "supabase",
      iat: now - 60,
      exp: now + 3600 * 24,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export const E2E_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? mintAnonJwt();

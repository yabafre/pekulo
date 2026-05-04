// apps/api/scripts/dev-token.ts
// Mint a synthetic Supabase JWT signed with the local SUPABASE_JWT_SECRET.
// Used by AC-1 / AC-3 smoke verification — NOT shipped in the production
// build (lives in scripts/, not src/).
//
// Usage:
//   bun apps/api/scripts/dev-token.ts <userId> [email]
//
// Example:
//   bun apps/api/scripts/dev-token.ts 11111111-1111-1111-1111-111111111111 alex@pekulo.app

import { SignJWT } from "jose";
import { config } from "dotenv";
import { resolve } from "node:path";

// Load .env / .env.local from repo root (same as Pekulo's monorepo convention).
config({ path: resolve(import.meta.dir, "..", "..", "..", ".env") });
config({ path: resolve(import.meta.dir, "..", "..", "..", ".env.local"), override: true });

const userId = process.argv[2];
const email = process.argv[3] ?? "alex@pekulo.app";
if (!userId) {
  console.error("usage: bun apps/api/scripts/dev-token.ts <userId> [email]");
  process.exit(1);
}

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error("SUPABASE_JWT_SECRET is not set or shorter than 32 chars");
  process.exit(1);
}

const token = await new SignJWT({ email })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(userId)
  .setIssuedAt()
  .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
  .sign(new TextEncoder().encode(secret));

// Single line — easy to capture into a shell var via $(...).
console.log(token);

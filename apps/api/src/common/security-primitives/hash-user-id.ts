// apps/api/src/common/security-primitives/hash-user-id.ts
// The ONLY shape a user identifier may take in a log line (architecture.md
// § Observability discipline: raw `user_id` is forbidden in any log). A
// SHA-256 prefix is stable enough to correlate two lines about the same user
// and to look the account up on purpose (hash the id you suspect, compare),
// while never being reversible from the log alone.
import { createHash } from "node:crypto";

export const USER_ID_HASH_LENGTH = 16;

export function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, USER_ID_HASH_LENGTH);
}

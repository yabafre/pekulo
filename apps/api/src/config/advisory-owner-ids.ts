// apps/api/src/config/advisory-owner-ids.ts
// Parses ADVISORY_OWNER_USER_IDS (story 12-1, ADR-0016 §4). The owner set is
// the root of trust for granting/banning advisory access: it lives in env,
// not in the database, so there is no bootstrap problem and an owner cannot
// be locked out (or ban themselves) through the API.
//
// Optional: unset/empty → nobody is an owner and the surface is locked down
// to allowlisted users only. A malformed UUID fails boot instead of silently
// dropping an owner.
import { ConfigError } from "./env";

// RFC 4122 shape; version/variant nibbles are not enforced because Supabase
// user IDs are UUID v4 in practice but the exact version is not ours to police.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAdvisoryOwnerUserIds(raw: string | undefined): ReadonlySet<string> {
  if (!raw || raw.trim() === "") return new Set();
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  const invalid = ids.filter((value) => !UUID_RE.test(value));
  if (invalid.length > 0) {
    throw new ConfigError({
      ADVISORY_OWNER_USER_IDS: [
        `invalid UUID(s): ${invalid.join(", ")} (expected comma-separated Supabase user IDs)`,
      ],
    });
  }
  return new Set(ids.map((value) => value.toLowerCase()));
}

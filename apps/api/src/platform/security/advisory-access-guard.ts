// apps/api/src/platform/security/advisory-access-guard.ts
// ADR-0016 §4 — private advisory-surface access gate (cross-cutting infra;
// consumed by the advisory module's service). Takes an injected reader so
// platform/ does NOT import modules/ (one-way layering). The advisory
// repository satisfies AdvisoryAccessReader structurally. The client's
// claimed allowlist state is NEVER trusted; only the row decides, and it is
// read on every request (no cache — AC-3).
import { PekuloError } from "../../common/errors";

export type AdvisoryAccessStatus = "active" | "banned";

export interface AdvisoryAccessReader {
  getAccessStatus(userId: string): Promise<AdvisoryAccessStatus | null>;
}

export async function requireAdvisoryAccess(
  reader: AdvisoryAccessReader,
  userId: string,
): Promise<void> {
  const status = await reader.getAccessStatus(userId);
  if (status !== "active") {
    // "banned" and "no row" are the same answer to the caller: the surface
    // is private, and telling a non-allowlisted user which of the two
    // applies would leak the allowlist's shape.
    throw new PekuloError("FORBIDDEN", "advisory surface is restricted to allowlisted users");
  }
}

import "server-only";

import type { Compass } from "@pekulo/validators";
import { compassClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";

// RSC-only reader used by the dashboard page to gate the setup-CTA branch
// on the server. Sibling readers for setup-state / current-progress flow
// through the React Query hooks once the user lands on the dashboard.

export async function readCompass(): Promise<{
  compass: Compass | null;
  source: "db" | "error";
  error?: string;
}> {
  try {
    await ensureRequestContext();
    const compass = await compassClient.getCompass();
    return { compass, source: "db" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { compass: null, source: "error", error: message };
  }
}

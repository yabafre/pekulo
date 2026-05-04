import "server-only";

import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";
import { hypothesisClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";

// Story 0-6: read path also goes through oRPC. The outer return shape is
// preserved so the 4 RSC callers (dashboard, parametres, mensuel,
// api/dashboard) stay byte-identical. `source: "default"` is unreachable
// post-bridge (apps/api always returns defaults when no row), but the
// discriminator is kept for caller robustness.

export async function readHypotheses(): Promise<{
  hypotheses: Hypotheses;
  source: "db" | "default" | "error";
  error?: string;
}> {
  try {
    await ensureRequestContext();
    const hypotheses = await hypothesisClient.get();
    return { hypotheses, source: "db" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // UNAUTHORIZED → render with defaults so the parametres page still
    // shows the form skeleton (the page-level auth guard already redirected
    // to login for truly logged-out users; this branch only fires on token
    // refresh races).
    if (message === "UNAUTHORIZED") {
      return { hypotheses: defaultHypotheses, source: "default" };
    }
    return {
      hypotheses: defaultHypotheses,
      source: "error",
      error: message,
    };
  }
}

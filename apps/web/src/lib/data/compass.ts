import "server-only";

import type { Compass, CompassProgress } from "@pekulo/validators";
import type { CompassSetupState } from "@pekulo/types";
import { compassClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";

// Mirror of `apps/web/src/lib/data/hypotheses.ts` — RSC-only readers used
// by the dashboard page to gate the setup-CTA branch on the server.

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

export async function readSetupState(): Promise<{
  state: CompassSetupState;
  source: "db" | "error";
  error?: string;
}> {
  try {
    await ensureRequestContext();
    const { state } = await compassClient.getSetupState();
    return { state, source: "db" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // UNAUTHORIZED → page-level auth guard already redirected to /auth/login;
    // any error here means token-refresh race — fall back to incomplete so
    // the setup CTA renders rather than a misleading donut.
    return { state: "incomplete", source: "error", error: message };
  }
}

export async function readCurrentProgress(): Promise<{
  progress: CompassProgress | null;
  source: "db" | "error";
  error?: string;
}> {
  try {
    await ensureRequestContext();
    const progress = await compassClient.getCurrentProgress();
    return { progress, source: "db" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { progress: null, source: "error", error: message };
  }
}

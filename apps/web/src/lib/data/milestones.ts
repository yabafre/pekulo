import "server-only";

import type { Milestone } from "@pekulo/validators";
import { milestonesClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";

export async function readMilestones(): Promise<{
  milestones: Milestone[];
  source: "db" | "error";
  error?: string;
}> {
  try {
    await ensureRequestContext();
    const milestones = await milestonesClient.list();
    return { milestones, source: "db" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { milestones: [], source: "error", error: message };
  }
}

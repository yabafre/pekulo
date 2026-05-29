// apps/api/src/modules/llm/llm.repository.ts
// Prisma persistence for the LLM module (story 6-1). Append-only writes to
// llm_call_log (NFR-26). Reads llm_opt_in (default false when no row). Every
// query carries `where: { userId }` (ADR-0013 + no-prisma-query-without-user-id).
// This is the ONLY place `llmCallLog.create` may appear (architecture L691).
import type { PrismaService } from "../../database";
import type { LlmCallEvent, LlmCallLogEntry } from "@pekulo/types";

export interface LlmRepository {
  recordCallEvent(userId: string, event: LlmCallEvent): Promise<void>;
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}

export function createLlmRepository(deps: { prismaService: PrismaService }): LlmRepository {
  const db = deps.prismaService.client;
  return {
    async recordCallEvent(userId, event) {
      await db.llmCallLog.create({
        data: {
          userId,
          callId: event.callId,
          phase: event.phase,
          route: event.route,
          labelHash: event.labelHash,
          latencyMs: event.phase === "outcome" ? event.latencyMs : null,
          outcome: event.phase === "outcome" ? event.outcome : null,
          // `id` is injected at create time by the prefixed-ids extension
          // (llm_<base62>), so it is intentionally absent here. The cast mirrors
          // transactions.repository — Prisma's generated type still demands it.
        } as unknown as Parameters<typeof db.llmCallLog.create>[0]["data"],
      });
    },
    async isThirdPartyOptedIn(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { thirdParty: true },
      });
      return row?.thirdParty ?? false;
    },
    async listRecentByUser(userId, since) {
      const rows = await db.llmCallLog.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      return rows.map((r) => ({
        id: r.id as LlmCallLogEntry["id"],
        callId: r.callId,
        phase: r.phase as "intent" | "outcome",
        route: r.route,
        latencyMs: r.latencyMs,
        outcome: (r.outcome as LlmCallLogEntry["outcome"]) ?? null,
        occurredAt: r.occurredAt.toISOString(),
      }));
    },
  };
}

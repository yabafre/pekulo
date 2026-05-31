// apps/api/src/modules/llm/llm.repository.ts
// Prisma persistence for the LLM module (story 6-1). Append-only writes to
// llm_call_log (NFR-26). Reads llm_opt_in (default false when no row). Every
// query carries `where: { userId }` (ADR-0013 + no-prisma-query-without-user-id).
// This is the ONLY place `llmCallLog.create` may appear (architecture L691).
import type { PrismaService } from "../../database";
import type { LlmCallEvent, LlmCallLogEntry } from "@pekulo/types";

export interface LlmRepository {
  recordCallEvent(userId: string, event: LlmCallEvent): Promise<void>;
  /** Append a set of events as a SINGLE transaction. Used by the attest path
   * (ADR-0008) so an intent+outcome pair can never half-commit (orphan intent
   * row on a crash between the two writes). */
  recordCallEvents(userId: string, events: LlmCallEvent[]): Promise<void>;
  isThirdPartyOptedIn(userId: string): Promise<boolean>;
  /** Set the per-user third-party opt-in flag (story 6-3, FR-34). Upserts the
   * single `llm_opt_in` row keyed on the UNIQUE(user_id) index and returns the
   * persisted value. Sole opt-in writer. */
  setThirdPartyOptIn(userId: string, value: boolean): Promise<boolean>;
  /** Story 6-4 (DR-12) — has the user seen the AI transparency notice? */
  getAiNoticeSeen(userId: string): Promise<boolean>;
  /** Story 6-4 (DR-12) — stamp ai_notice_seen_at = now (P2002-safe upsert). */
  markAiNoticeSeen(userId: string): Promise<void>;
  listRecentByUser(userId: string, since: Date): Promise<LlmCallLogEntry[]>;
}

export function createLlmRepository(deps: { prismaService: PrismaService }): LlmRepository {
  const db = deps.prismaService.client;
  // The ONLY `llmCallLog.create` call site (architecture L691). Both the single
  // and the transactional writers funnel through this builder so the single-
  // writer grep gate stays at one create call.
  function createCallEvent(userId: string, event: LlmCallEvent) {
    return db.llmCallLog.create({
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
  }
  return {
    async recordCallEvent(userId, event) {
      await createCallEvent(userId, event);
    },
    async recordCallEvents(userId, events) {
      await db.$transaction(events.map((event) => createCallEvent(userId, event)));
    },
    async isThirdPartyOptedIn(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { thirdParty: true },
      });
      return row?.thirdParty ?? false;
    },
    async setThirdPartyOptIn(userId, value) {
      try {
        const row = await db.llmOptIn.upsert({
          where: { userId },
          // `id` is injected by the prefixed-ids extension at create time
          // (llmo_<base62>), so it is intentionally absent here — same cast
          // as createCallEvent. Prisma's generated type still demands it.
          create: {
            userId,
            thirdParty: value,
          } as unknown as Parameters<typeof db.llmOptIn.upsert>[0]["create"],
          update: { thirdParty: value },
          select: { thirdParty: true },
        });
        return row.thirdParty;
      } catch (err) {
        // Two concurrent first-time opt-ins both find no row and race the
        // create branch; the loser hits the UNIQUE(user_id) index. Re-apply as
        // an update (lesson 2026-05-27 — find-or-create P2002 re-read). Duck-typed
        // code check mirrors realestate.repository.ts:203 / transactions:359.
        if ((err as { code?: string }).code === "P2002") {
          const row = await db.llmOptIn.update({
            where: { userId },
            data: { thirdParty: value },
            select: { thirdParty: true },
          });
          return row.thirdParty;
        }
        throw err;
      }
    },
    async getAiNoticeSeen(userId) {
      const row = await db.llmOptIn.findUnique({
        where: { userId },
        select: { aiNoticeSeenAt: true },
      });
      return row?.aiNoticeSeenAt != null;
    },
    async markAiNoticeSeen(userId) {
      const now = new Date();
      try {
        await db.llmOptIn.upsert({
          where: { userId },
          create: { userId, aiNoticeSeenAt: now } as unknown as Parameters<
            typeof db.llmOptIn.upsert
          >[0]["create"],
          update: { aiNoticeSeenAt: now },
        });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") {
          await db.llmOptIn.update({ where: { userId }, data: { aiNoticeSeenAt: now } });
          return;
        }
        throw err;
      }
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

import { describe, expect, test, mock } from "bun:test";
import { createLlmRepository } from "./llm.repository";

describe("ai-notice flag (6-4)", () => {
  test("getAiNoticeSeen → false when no row / null timestamp", async () => {
    const findUnique = mock(async () => null);
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);
  });

  test("getAiNoticeSeen → true when ai_notice_seen_at is set", async () => {
    const findUnique = mock(async () => ({ aiNoticeSeenAt: new Date() }));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { findUnique } } },
    } as never);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  test("markAiNoticeSeen upserts with ai_notice_seen_at", async () => {
    const upsert = mock(async (_args: { where: unknown; update: Record<string, unknown> }) => ({}));
    const repo = createLlmRepository({
      prismaService: { client: { llmOptIn: { upsert } } },
    } as never);
    await repo.markAiNoticeSeen("u1");
    const [arg] = upsert.mock.calls[0] as [{ where: unknown; update: Record<string, unknown> }];
    expect(arg.where).toMatchObject({ userId: "u1" });
    expect(arg.update.aiNoticeSeenAt).toBeInstanceOf(Date);
  });
});

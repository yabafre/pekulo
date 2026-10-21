import { describe, expect, test, mock } from "bun:test";
import { createLlmRepository } from "./llm.repository";

interface StoredRow {
  userId: string;
  thirdParty: boolean;
  aiNoticeSeenAt: Date | null;
}

function makeStatefulRepo() {
  const rows = new Map<string, StoredRow>();
  const repo = createLlmRepository({
    prismaService: {
      client: {
        llmOptIn: {
          findUnique: mock(async ({ where }: { where: { userId: string } }) => {
            return rows.get(where.userId) ?? null;
          }),
          upsert: mock(
            async ({
              where,
              create,
              update,
            }: {
              where: { userId: string };
              create: Partial<StoredRow> & { userId: string };
              update: Partial<StoredRow>;
            }) => {
              const current = rows.get(where.userId);
              const next: StoredRow = current
                ? {
                    ...current,
                    ...(update.thirdParty !== undefined ? { thirdParty: update.thirdParty } : {}),
                    ...(update.aiNoticeSeenAt !== undefined
                      ? { aiNoticeSeenAt: update.aiNoticeSeenAt }
                      : {}),
                  }
                : {
                    userId: create.userId,
                    thirdParty: create.thirdParty ?? false,
                    aiNoticeSeenAt: create.aiNoticeSeenAt ?? null,
                  };
              rows.set(where.userId, next);
              return next;
            },
          ),
          update: mock(
            async ({ where, data }: { where: { userId: string }; data: Partial<StoredRow> }) => {
              const current = rows.get(where.userId) ?? {
                userId: where.userId,
                thirdParty: false,
                aiNoticeSeenAt: null,
              };
              const next: StoredRow = {
                ...current,
                ...(data.thirdParty !== undefined ? { thirdParty: data.thirdParty } : {}),
                ...(data.aiNoticeSeenAt !== undefined
                  ? { aiNoticeSeenAt: data.aiNoticeSeenAt }
                  : {}),
              };
              rows.set(where.userId, next);
              return next;
            },
          ),
        },
      },
    },
  } as never);
  return { repo, rows };
}

describe("ai-notice flag (6-4 + 11-5)", () => {
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

  // AC-2 (verbatim from docs/stories/11-5-ai-transparency-notice.md:15):
  //   Given I have already seen the AI transparency notice, When my third-party
  //   AI model preference transitions from opted-out to opted-in (including after
  //   an opt-in → opt-out → opt-in cycle), Then the server resets my AI
  //   transparency notice seen status (whereas opting out or repeating an
  //   already-enabled opt-in preserves the seen status), the client cache for the
  //   AI notice is invalidated, and the notice is re-shown on the next user-visible
  //   AI suggestion without requiring a hard page reload.
  test("11-5 AC-2: opt-in → opt-out → opt-in resets ai_notice_seen_at so the notice is re-shown", async () => {
    const { repo } = makeStatefulRepo();

    // Initial state: user sees first-time notice and opts in
    await repo.setThirdPartyOptIn("u1", true);
    await repo.markAiNoticeSeen("u1");
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);

    // Opt-out (true → false): does NOT reset aiNoticeSeenAt while opted out
    await repo.setThirdPartyOptIn("u1", false);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);

    // Re-opt-in (false → true): resets aiNoticeSeenAt to null so notice re-triggers
    await repo.setThirdPartyOptIn("u1", true);
    expect(await repo.getAiNoticeSeen("u1")).toBe(false);

    // Once marked seen again, an idempotent setThirdPartyOptIn(true) preserves seen=true
    await repo.markAiNoticeSeen("u1");
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
    await repo.setThirdPartyOptIn("u1", true);
    expect(await repo.getAiNoticeSeen("u1")).toBe(true);
  });

  // AC-4 (verbatim from docs/stories/11-5-ai-transparency-notice.md:17):
  //   Given two distinct users User A and User B, When User A marks the AI
  //   transparency notice as seen or transitions from opt-out to opt-in, Then
  //   User B's seen status and third-party opt-in preference remain completely
  //   unaffected, and automated accessibility checks report zero WCAG 2.2 AA
  //   violations on both the AI transparency notice and the Artificial
  //   Intelligence settings section.
  test("11-5 AC-4: two-user isolation — user A opt-out → opt-in and markAiNoticeSeen never mutate user B", async () => {
    const { repo } = makeStatefulRepo();

    await repo.setThirdPartyOptIn("user-a", true);
    await repo.markAiNoticeSeen("user-a");
    await repo.setThirdPartyOptIn("user-b", true);
    await repo.markAiNoticeSeen("user-b");

    expect(await repo.getAiNoticeSeen("user-a")).toBe(true);
    expect(await repo.getAiNoticeSeen("user-b")).toBe(true);

    // User A cycles opt-out → opt-in: User A resets to unseen, User B stays seen
    await repo.setThirdPartyOptIn("user-a", false);
    await repo.setThirdPartyOptIn("user-a", true);

    expect(await repo.getAiNoticeSeen("user-a")).toBe(false);
    expect(await repo.getAiNoticeSeen("user-b")).toBe(true);
    expect(await repo.isThirdPartyOptedIn("user-b")).toBe(true);
  });
});

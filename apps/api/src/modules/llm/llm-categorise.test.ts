// bun:test — llm.service.categorise (story 6-2, AC-1/AC-2/AC-3).
import { test, expect } from "bun:test";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import { createLlmService, type RouteIntent } from "./llm.service";

const CATS = ["courses", "transport", "sorties"] as const;

function makeService(
  opts: {
    raw?: string;
    throws?: boolean;
    intentThrows?: boolean;
    // story 6-x fallback knobs:
    optedIn?: boolean;
    tpRaw?: string;
    tpThrows?: boolean;
  } = {},
) {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const calls = { ollama: 0, thirdParty: 0 };
  const repository: LlmRepository = {
    recordCallEvent: async (userId, event) => {
      if (opts.intentThrows && event.phase === "intent") throw new Error("audit db down");
      events.push({ userId, event });
    },
    recordCallEvents: async (userId, evs) => {
      for (const event of evs) events.push({ userId, event });
    },
    isThirdPartyOptedIn: async () => opts.optedIn ?? false,
    setThirdPartyOptIn: async () => opts.optedIn ?? false,
    getAiNoticeSeen: async () => false,
    markAiNoticeSeen: async () => {},
    listRecentByUser: async () => [],
  };
  const ollamaClient: LlmProvider = {
    route: "ollama",
    complete: async () => {
      calls.ollama += 1;
      if (opts.throws) throw new Error("boom");
      return { raw: opts.raw ?? '{"category":"courses","confidence":0.88}', latencyMs: 12 };
    },
  };
  const thirdPartyClient: LlmProvider = {
    route: "third_party",
    complete: async () => {
      calls.thirdParty += 1;
      if (opts.tpThrows) throw new Error("tp boom");
      return { raw: opts.tpRaw ?? "{}", latencyMs: 1 };
    },
  };
  let n = 0;
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => `call_${++n}`,
  });
  return { service, events, calls };
}

const intent = (): RouteIntent => ({
  userId: "u1",
  clientCapabilities: { iosFoundationModels: false },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
  categories: CATS,
});

test("AC-1: ollama route returns {category, confidence} in [0,1]", async () => {
  const { service } = makeService();
  const out = await service.categorise(intent());
  expect(out.route).toBe("ollama");
  expect(out.category).toBe("courses");
  expect(out.confidence).toBeGreaterThanOrEqual(0);
  expect(out.confidence).toBeLessThanOrEqual(1);
});

test("AC-3: one intent + one outcome row for the same callId, no PII", async () => {
  const { service, events } = makeService();
  await service.categorise(intent());
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(events[0]!.event.callId).toBe(events[1]!.event.callId);
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("success");
  expect(JSON.stringify(events)).not.toContain("Carrefour");
});

test("AC-2: out-of-enum completion abstains + records a failure outcome", async () => {
  const { service, events } = makeService({ raw: '{"category":"crypto","confidence":0.99}' });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("failure");
});

test("AC-2: provider failure abstains without throwing + records failure", async () => {
  const { service, events } = makeService({ throws: true });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.confidence).toBe(0);
  const outcome = events[1]!.event;
  expect(outcome.phase === "outcome" && outcome.outcome).toBe("failure");
});

test("AC-2: an intent-row write failure abstains without throwing (no orphan row)", async () => {
  // The audit DB rejects the intent write. categorise must honour its
  // never-throws contract: abstain, persist nothing (no orphan intent row),
  // and report the routed server route.
  const { service, events } = makeService({ intentThrows: true });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.confidence).toBe(0);
  expect(out.route).toBe("ollama");
  expect(events).toHaveLength(0);
});

// ── Third-party fallback (user decision 2026-05-31) ────────────────────────
// Ollama is local-first; on transport failure AND opt-in, escalate to third
// party. Web traffic routes to ollama, so this is what the opt-in toggle drives.

test("fallback: opted-in + Ollama throws → third_party categorises", async () => {
  const { service, events, calls } = makeService({
    throws: true,
    optedIn: true,
    tpRaw: '{"category":"transport","confidence":0.8}',
  });
  const out = await service.categorise(intent());
  expect(out.route).toBe("third_party");
  expect(out.category).toBe("transport");
  expect(calls.ollama).toBe(1);
  expect(calls.thirdParty).toBe(1);
  // Audit: ollama intent+failure, then third_party intent+success (distinct callIds).
  expect(events.map((e) => `${e.event.route}:${e.event.phase}`)).toEqual([
    "ollama:intent",
    "ollama:outcome",
    "third_party:intent",
    "third_party:outcome",
  ]);
  const tpOutcome = events[3]!.event;
  expect(tpOutcome.phase === "outcome" && tpOutcome.outcome).toBe("success");
});

test("no fallback when NOT opted in (Ollama throws → abstain on ollama)", async () => {
  const { service, calls } = makeService({ throws: true, optedIn: false });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.route).toBe("ollama");
  expect(calls.thirdParty).toBe(0);
});

test("no fallback when Ollama succeeds, even if opted in", async () => {
  const { service, calls } = makeService({ optedIn: true });
  const out = await service.categorise(intent());
  expect(out.route).toBe("ollama");
  expect(out.category).toBe("courses");
  expect(calls.thirdParty).toBe(0);
});

test("no fallback on a clean Ollama abstention (out-of-enum, opted in)", async () => {
  // Ollama answered (no throw) but the category is out of the closed list → a
  // clean abstention, NOT a transport failure → third party is NOT called.
  const { service, calls } = makeService({
    raw: '{"category":"crypto","confidence":0.9}',
    optedIn: true,
  });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.route).toBe("ollama");
  expect(calls.thirdParty).toBe(0);
});

test("fallback: both Ollama and third_party fail → abstain on third_party", async () => {
  const { service, calls } = makeService({ throws: true, optedIn: true, tpThrows: true });
  const out = await service.categorise(intent());
  expect(out.category).toBeNull();
  expect(out.route).toBe("third_party");
  expect(calls.ollama).toBe(1);
  expect(calls.thirdParty).toBe(1);
});

test("foundation_models abstains with no outcome row (client-owned)", async () => {
  const { service, events } = makeService();
  const out = await service.categorise({
    ...intent(),
    clientCapabilities: { iosFoundationModels: true },
  });
  expect(out.route).toBe("foundation_models");
  expect(out.category).toBeNull();
  expect(events.map((e) => e.event.phase)).toEqual(["intent"]);
});

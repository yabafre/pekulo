// bun:test — LLM routing policy + audit authority (story 6-1, AC-1/2/4).
import { test, expect, mock } from "bun:test";
import type { LlmCallEvent } from "@pekulo/types";
import type { LlmProvider } from "./llm-provider";
import type { LlmRepository } from "./llm.repository";
import { createLlmService, type RouteIntent } from "./llm.service";

function makeService(overrides?: { optedIn?: boolean }) {
  const events: Array<{ userId: string; event: LlmCallEvent }> = [];
  const repository: LlmRepository = {
    recordCallEvent: async (userId, event) => {
      events.push({ userId, event });
    },
    recordCallEvents: async (userId, evs) => {
      for (const event of evs) events.push({ userId, event });
    },
    isThirdPartyOptedIn: async () => overrides?.optedIn ?? false,
    listRecentByUser: async () => [],
  };
  const ollamaClient: LlmProvider = {
    route: "ollama",
    complete: mock(async () => ({ raw: "ollama", latencyMs: 1 })),
  };
  const thirdPartyClient: LlmProvider = {
    route: "third_party",
    complete: mock(async () => ({ raw: "cloud", latencyMs: 1 })),
  };
  let n = 0;
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => `call_${++n}`,
  });
  return { service, events, ollamaClient, thirdPartyClient };
}

const baseIntent = (iosFoundationModels: boolean): RouteIntent => ({
  userId: "u1",
  clientCapabilities: { iosFoundationModels },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
});

test("AC-1: iOS-capable → foundation_models + null providerCall + intent row", async () => {
  const { service, events } = makeService();
  const decision = await service.route(baseIntent(true));
  expect(decision.route).toBe("foundation_models");
  expect(decision.providerCall).toBeNull();
  expect(events).toHaveLength(1);
  expect(events[0]!.event).toMatchObject({ phase: "intent", route: "foundation_models" });
  // No prompt body in the audit event — only a label hash.
  expect(JSON.stringify(events[0]!.event)).not.toContain("Carrefour");
});

test("AC-2: non-iOS + optIn:false → ollama, third_party never returned", async () => {
  const { service } = makeService({ optedIn: false });
  const decision = await service.route(baseIntent(false));
  expect(decision.route).toBe("ollama");
  expect(decision.route).not.toBe("third_party");
  expect(typeof decision.providerCall).toBe("function");
});

test("AC-4: recordLlmCall writes the intent → outcome pair, no prompt body", async () => {
  const { service, events } = makeService();
  await service.recordLlmCall("u1", {
    phase: "intent",
    callId: "c9",
    route: "ollama",
    labelHash: "h",
  });
  await service.recordLlmCall("u1", {
    phase: "outcome",
    callId: "c9",
    route: "ollama",
    labelHash: "h",
    latencyMs: 250,
    outcome: "success",
  });
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(JSON.stringify(events)).not.toContain("Carrefour");
});

test("AC-4: recordLlmCallPair writes both rows via one repository transaction call", async () => {
  const { service, events } = makeService();
  await service.recordLlmCallPair("u1", [
    { phase: "intent", callId: "fm1", route: "foundation_models", labelHash: "h" },
    {
      phase: "outcome",
      callId: "fm1",
      route: "foundation_models",
      labelHash: "h",
      latencyMs: 480,
      outcome: "success",
    },
  ]);
  expect(events.map((e) => e.event.phase)).toEqual(["intent", "outcome"]);
  expect(events.every((e) => e.event.route === "foundation_models")).toBe(true);
});

test("recordLlmCallPair rejects an unknown route in either event", async () => {
  const { service } = makeService();
  await expect(
    service.recordLlmCallPair("u1", [
      { phase: "intent", callId: "c1", route: "gpt" as never, labelHash: "h" },
      {
        phase: "outcome",
        callId: "c1",
        route: "gpt" as never,
        labelHash: "h",
        latencyMs: 1,
        outcome: "success",
      },
    ]),
  ).rejects.toThrow(/unknown route/);
});

test("recordLlmCall rejects an unknown route", async () => {
  const { service } = makeService();
  await expect(
    service.recordLlmCall("u1", {
      phase: "intent",
      callId: "c1",
      route: "gpt" as never,
      labelHash: "h",
    }),
  ).rejects.toThrow(/unknown route/);
});

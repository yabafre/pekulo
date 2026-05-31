// bun:test — third-party opt-in (story 6-3, AC-1/AC-2/AC-3). Uses a fake Prisma
// (no Postgres harness in-repo; mirrors llm.module.test.ts) supporting
// llmOptIn.{findUnique,upsert,update} + llmCallLog.create (route() writes an
// intent row). RLS-policy coverage is verified separately by db:rls-audit.
import { expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import type { JwtVerifier } from "../../platform/security";
import { createLlmModule } from "./llm.module";
import { createLlmRepository } from "./llm.repository";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { requireThirdPartyOptIn } from "../../platform/security/opt-in-guard";

function makeFakeDb(): PrismaService {
  let optIn: { userId: string; thirdParty: boolean } | null = null;
  const client = {
    llmCallLog: {
      create: async () => undefined,
      findMany: async () => [],
    },
    llmOptIn: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        optIn && optIn.userId === where.userId ? { thirdParty: optIn.thirdParty } : null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId: string };
        create: { userId: string; thirdParty: boolean };
        update: { thirdParty: boolean };
      }) => {
        optIn =
          optIn && optIn.userId === where.userId
            ? { ...optIn, thirdParty: update.thirdParty }
            : { userId: create.userId, thirdParty: create.thirdParty };
        return { thirdParty: optIn.thirdParty };
      },
      update: async ({
        where,
        data,
      }: {
        where: { userId: string };
        data: { thirdParty: boolean };
      }) => {
        optIn = { userId: where.userId, thirdParty: data.thirdParty };
        return { thirdParty: optIn.thirdParty };
      },
    },
  };
  return { client } as unknown as PrismaService;
}

const fakeJwt = { verify: async () => ({ sub: "u-a", email: null }) } as unknown as JwtVerifier;
const fakeEnv = {} as unknown as Env;

function makeModule() {
  return createLlmModule({ prismaService: makeFakeDb(), env: fakeEnv, jwtVerifier: fakeJwt });
}

const intent = (iosFoundationModels: boolean) => ({
  userId: "user-a",
  clientCapabilities: { iosFoundationModels },
  prompt: { label: "Carrefour", amount: -42.5, currency: "EUR", occurredOn: "2026-05-15" },
});

// AC-1 (verbatim from docs/stories/6-3-llm-opt-in.md:19):
//   Given any client (iOS-capable or a web client), When the system decides
//   which LLM endpoint to use for a categorisation, Then it selects on-device
//   FoundationModels for an iOS-capable client and the self-hosted Ollama model
//   otherwise, and never the third-party API. A build-failing test asserts the
//   third-party route is never auto-selected for either client.
test("AC-1: route() never returns third_party for any client capability", async () => {
  const mod = makeModule();
  const web = await mod.service.route(intent(false));
  const ios = await mod.service.route(intent(true));
  expect(web.route).toBe("ollama");
  expect(ios.route).toBe("foundation_models");
  expect([web.route, ios.route]).not.toContain("third_party");
});

// AC-3 (verbatim from docs/stories/6-3-llm-opt-in.md:21):
//   Given the opt-in defaults to off (no stored preference), When the user turns
//   it on, Then the preference is stored under their account; When they turn it
//   off, Then the same single per-user preference is updated (not duplicated).
//   Two concurrent first-time changes never surface a server error.
test("AC-3: setThirdPartyOptIn upserts (create then update); default false", async () => {
  const mod = makeModule();
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false); // no row → false
  expect(await mod.service.setThirdPartyOptIn("user-a", true)).toBe(true); // create branch
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(true);
  expect(await mod.service.setThirdPartyOptIn("user-a", false)).toBe(false); // update same row
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false);
});

// AC-2 (verbatim from docs/stories/6-3-llm-opt-in.md:20):
//   Given a user who has not opted in, When the system is about to send a prompt
//   to the third-party API, Then it refuses with an opt-in-required error (HTTP
//   403) and sends nothing. Given the same user after opting in, When the same
//   path runs, Then it is permitted. The opt-in state is read on the server,
//   never trusted from the client.
test("AC-2: guard rejects when opt-in false, resolves once persisted true", async () => {
  const mod = makeModule();
  // The repository is structurally a ThirdPartyOptInReader.
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).rejects.toMatchObject({
    code: "LLM_OPT_IN_REQUIRED",
  });
  await mod.service.setThirdPartyOptIn("user-a", true);
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).resolves.toBeUndefined();
});

// AC-2 (review): the AC text promises the refusal is "an opt-in-required error
// (HTTP 403)" — not merely an error code. Assert the wire status the Elysia
// error mapper produces for LLM_OPT_IN_REQUIRED is 403 (error-mapper.ts:75), so
// the "HTTP 403" half of the AC is covered, not just the code.
test("AC-2: the opt-in-required refusal maps to HTTP 403 on the wire", async () => {
  const mod = makeModule();
  const err = await requireThirdPartyOptIn(mod.repository, "user-a").catch((e: unknown) => e);
  const mapped = mapErrorToOrpcResponse(err, "req-test");
  expect(mapped.status).toBe(403);
  expect((mapped.body as { code: string }).code).toBe("LLM_OPT_IN_REQUIRED");
});

// AC-3 (review): the AC's concurrency sentence — "Two concurrent first-time
// changes never surface a server error" — rests entirely on the repository's
// P2002 catch+re-read branch (llm.repository.ts), which the fake above never
// triggers. Drive it directly: an upsert that loses the UNIQUE(user_id) race
// throws P2002; setThirdPartyOptIn must re-apply as an update and resolve, never
// surfacing the violation (lesson 2026-05-27 — find-or-create P2002 re-read).
test("AC-3 concurrency: setThirdPartyOptIn re-reads via update when the create branch loses the P2002 race", async () => {
  const upsertAttempts: boolean[] = [];
  const updateApplied: boolean[] = [];
  const racingDb = {
    client: {
      llmOptIn: {
        upsert: async ({ create }: { create: { thirdParty: boolean } }) => {
          upsertAttempts.push(create.thirdParty);
          throw { code: "P2002" }; // loser hits the UNIQUE(user_id) index
        },
        update: async ({ data }: { data: { thirdParty: boolean } }) => {
          updateApplied.push(data.thirdParty);
          return { thirdParty: data.thirdParty };
        },
      },
    },
  } as unknown as PrismaService;
  const repo = createLlmRepository({ prismaService: racingDb });
  expect(await repo.setThirdPartyOptIn("user-a", true)).toBe(true);
  expect(upsertAttempts).toEqual([true]); // the create branch was attempted once
  expect(updateApplied).toEqual([true]); // re-applied as an update — no server error surfaced
});

// AC-3 (review): a NON-P2002 error must NOT be swallowed by the race handler —
// it rethrows so genuine failures still surface (the catch is narrow, not a
// blanket swallow).
test("AC-3: a non-P2002 upsert error is rethrown, not swallowed", async () => {
  const failingDb = {
    client: {
      llmOptIn: {
        upsert: async () => {
          throw { code: "P2010", message: "raw query failed" };
        },
        update: async () => {
          throw new Error("update must not be reached on a non-P2002 error");
        },
      },
    },
  } as unknown as PrismaService;
  const repo = createLlmRepository({ prismaService: failingDb });
  await expect(repo.setThirdPartyOptIn("user-a", true)).rejects.toMatchObject({ code: "P2010" });
});

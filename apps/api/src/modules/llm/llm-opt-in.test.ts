// bun:test — third-party opt-in (story 6-3, AC-1/AC-2/AC-3). Uses a fake Prisma
// (no Postgres harness in-repo; mirrors llm.module.test.ts) supporting
// llmOptIn.{findUnique,upsert,update} + llmCallLog.create (route() writes an
// intent row). RLS-policy coverage is verified separately by db:rls-audit.
import { expect, test } from "bun:test";
import type { PrismaService } from "../../database";
import type { Env } from "../../config/env";
import type { JwtVerifier } from "../../platform/security";
import { createLlmModule } from "./llm.module";
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

test("AC-1: route() never returns third_party for any client capability", async () => {
  const mod = makeModule();
  const web = await mod.service.route(intent(false));
  const ios = await mod.service.route(intent(true));
  expect(web.route).toBe("ollama");
  expect(ios.route).toBe("foundation_models");
  expect([web.route, ios.route]).not.toContain("third_party");
});

test("AC-3: setThirdPartyOptIn upserts (create then update); default false", async () => {
  const mod = makeModule();
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false); // no row → false
  expect(await mod.service.setThirdPartyOptIn("user-a", true)).toBe(true); // create branch
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(true);
  expect(await mod.service.setThirdPartyOptIn("user-a", false)).toBe(false); // update same row
  expect(await mod.service.getThirdPartyOptIn("user-a")).toBe(false);
});

test("AC-2: guard rejects when opt-in false, resolves once persisted true", async () => {
  const mod = makeModule();
  // The repository is structurally a ThirdPartyOptInReader.
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).rejects.toMatchObject({
    code: "LLM_OPT_IN_REQUIRED",
  });
  await mod.service.setThirdPartyOptIn("user-a", true);
  await expect(requireThirdPartyOptIn(mod.repository, "user-a")).resolves.toBeUndefined();
});

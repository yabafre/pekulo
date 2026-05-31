// apps/api/src/modules/llm/llm.module.ts
// Composition root for the LLM module. Returns { service, repository,
// attestRouter, router }. Story 6-1 shipped the service + repository + the
// Elysia-native /internal/llm/attest listener; story 6-3 (FR-34) adds the
// client-facing oRPC router (getOptIn/setOptIn) mounted under /rpc/v1/llm.
// L8: inferred return type, never annotate bare Elysia.
import type { Env } from "../../config/env";
import type { PrismaService } from "../../database";
import type { JwtVerifier } from "../../platform/security";
import { generateBase62Id } from "../../database/base62";
import { createLlmRepository } from "./llm.repository";
import { createLlmService } from "./llm.service";
import { createOllamaClient } from "./services/ollama-client";
import { createThirdPartyClient } from "./services/third-party-client";
import { createLlmAttestRouter } from "./llm.attest-router";
import { createLlmRouter } from "./llm.routes";

export function createLlmModule(deps: {
  prismaService: PrismaService;
  env: Env;
  jwtVerifier: JwtVerifier;
}) {
  const repository = createLlmRepository({ prismaService: deps.prismaService });
  const ollamaClient = createOllamaClient({ env: deps.env });
  const thirdPartyClient = createThirdPartyClient({ env: deps.env });
  const service = createLlmService({
    repository,
    ollamaClient,
    thirdPartyClient,
    optInReader: repository,
    generateCallId: () => generateBase62Id(21),
  });
  const attestRouter = createLlmAttestRouter({ jwtVerifier: deps.jwtVerifier, service });
  const router = createLlmRouter({ service });
  return { service, repository, attestRouter, router };
}

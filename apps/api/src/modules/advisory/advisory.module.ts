// Module factory wiring repository + access service + analysis service + LLM service + router
// for the private advisory surface (stories 12-1, 12-2, 12-3, ADR-0016).
// Mirrors ADR-0009 (createXxxModule(deps) → { service, analysis, llm, router }).
import type { PrismaService } from "../../database";
import type { LlmService } from "../llm/llm.service";
import type { LlmProvider } from "../llm/llm-provider";
import {
  createAdvisoryAnalysisService,
  type AdvisoryAnalysisPorts,
  type AdvisoryAnalysisService,
} from "./advisory-analysis.service";
import { createAdvisoryRepository } from "./advisory.repository";
import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
import { createAdvisoryRouter } from "./advisory.routes";
import { createAdvisoryEncryptor } from "./advisory-encryption";
import {
  createAdvisorySessionRepository,
  type AdvisorySessionRepository,
} from "./advisory-session.repository";
import { createAdvisoryLlmService, type AdvisoryLlmService } from "./advisory-llm.service";
import type { AdvisoryPostureConfig } from "./advisory-posture";

export interface AdvisoryModule {
  service: AdvisoryAccessService;
  analysis: AdvisoryAnalysisService;
  llm: AdvisoryLlmService;
  sessionRepository: AdvisorySessionRepository;
  router: ReturnType<typeof createAdvisoryRouter>;
}

export function createAdvisoryModule(
  deps: {
    prismaService: PrismaService;
    ownerUserIds: ReadonlySet<string>;
    llmService?: LlmService;
    llmProvider?: LlmProvider;
    advisorySecretKey?: string;
    postureConfig?: AdvisoryPostureConfig;
    sessionRepository?: AdvisorySessionRepository;
    llm?: AdvisoryLlmService;
  } & AdvisoryAnalysisPorts,
): AdvisoryModule {
  const repository = createAdvisoryRepository({ client: deps.prismaService.client });
  const service = createAdvisoryService({
    repository,
    ownerUserIds: deps.ownerUserIds,
  });
  const analysis = createAdvisoryAnalysisService(deps);

  const encryptor = createAdvisoryEncryptor(
    deps.advisorySecretKey ?? "pekulo-advisory-default-secret-key-32b",
  );
  const sessionRepository =
    deps.sessionRepository ??
    createAdvisorySessionRepository({ client: deps.prismaService.client, encryptor });

  const llm =
    deps.llm ??
    (deps.llmService && deps.llmProvider
      ? createAdvisoryLlmService({
          analysisService: analysis,
          sessionRepository,
          llmService: deps.llmService,
          llmProvider: deps.llmProvider,
          postureConfig: deps.postureConfig ?? {},
        })
      : ({
          generateAnalysis: async () => {
            throw new Error("LLM service not configured");
          },
          getLatestSession: async () => sessionRepository.findLatestByUserId(""),
          listSessions: async () => ({ sessions: [], totalCount: 0 }),
        } as unknown as AdvisoryLlmService));

  const router = createAdvisoryRouter({ service, analysis, llm });
  return { service, analysis, llm, sessionRepository, router };
}

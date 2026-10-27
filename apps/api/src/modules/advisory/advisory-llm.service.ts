// apps/api/src/modules/advisory/advisory-llm.service.ts
// Advisory LLM orchestration service with grounding enforcement and audit logging (story 12-3, AC-1..AC-4, ADR-0016).

import crypto from "node:crypto";
import type { LlmProvider } from "../llm/llm-provider";
import type { LlmService } from "../llm/llm.service";
import type { AdvisoryAnalysisService } from "./advisory-analysis.service";
import type { AdvisorySessionRepository } from "./advisory-session.repository";
import { buildAdvisoryPrompt } from "./advisory-prompt-builder";
import { validateAdvisoryGrounding } from "./advisory-grounding-validator";
import { assertAdvisoryProviderPosture, type AdvisoryPostureConfig } from "./advisory-posture";
import {
  advisoryAnalysisResultSchema,
  type AdvisorySession,
  type AdvisorySessionList,
} from "@pekulo/validators";
import { PekuloError } from "../../common/errors";

export interface AdvisoryLlmService {
  generateAnalysis(userId: string, forceRefresh?: boolean): Promise<AdvisorySession>;
  getLatestSession(userId: string): Promise<AdvisorySession | null>;
  listSessions(userId: string): Promise<AdvisorySessionList>;
}

// AC-2 (verbatim from story 12-3:18):
//   Given an advisory LLM call, When it completes (success or failure),
//   Then an intent + outcome pair is recorded via the single server-side writer
//   (LlmService.recordLlmCallPair), with no prompt text, user financial amounts,
//   or plaintext recommendations persisted in llm_call_log (task/label hash only).
export function createAdvisoryLlmService(deps: {
  analysisService: AdvisoryAnalysisService;
  sessionRepository: AdvisorySessionRepository;
  llmService: LlmService;
  llmProvider: LlmProvider;
  postureConfig: AdvisoryPostureConfig;
}): AdvisoryLlmService {
  const posture = assertAdvisoryProviderPosture(deps.postureConfig);

  return {
    async generateAnalysis(userId: string, forceRefresh = false): Promise<AdvisorySession> {
      if (!forceRefresh) {
        const latest = await deps.sessionRepository.findLatestByUserId(userId);
        if (latest) {
          const ageMs = Date.now() - new Date(latest.createdAt).getTime();
          // Cache valid for 1 hour unless forceRefresh
          if (ageMs < 60 * 60 * 1000) {
            return latest;
          }
        }
      }

      const snapshot = await deps.analysisService.getSnapshot(userId);
      const prompt = buildAdvisoryPrompt(snapshot);
      const callId = `adv_call_${crypto.randomUUID()}`;
      const labelHash = crypto.createHash("sha256").update("advisory_analysis").digest("hex");

      const startTime = performance.now();
      let rawCompletionText = "";
      try {
        const completion = await deps.llmProvider.complete(prompt);
        rawCompletionText = completion.raw;
        const latencyMs = Math.round(performance.now() - startTime);

        // Record success audit pair through single writer
        await deps.llmService.recordLlmCallPair(userId, [
          { phase: "intent", callId, route: posture.route, labelHash },
          {
            phase: "outcome",
            callId,
            route: posture.route,
            labelHash,
            latencyMs,
            outcome: "success",
          },
        ]);
      } catch (err) {
        const latencyMs = Math.round(performance.now() - startTime);
        await deps.llmService.recordLlmCallPair(userId, [
          { phase: "intent", callId, route: posture.route, labelHash },
          {
            phase: "outcome",
            callId,
            route: posture.route,
            labelHash,
            latencyMs,
            outcome: "failure",
          },
        ]);
        throw new PekuloError(
          "INTERNAL",
          `Advisory LLM provider execution failed: ${(err as Error).message}`,
        );
      }

      // Clean markdown backticks if present
      const jsonText = rawCompletionText
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(jsonText);
      } catch {
        throw new PekuloError("INTERNAL", "LLM completion did not produce valid JSON");
      }

      const parsed = advisoryAnalysisResultSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new PekuloError(
          "INTERNAL",
          `LLM output schema validation failed: ${parsed.error.message}`,
        );
      }

      // Grounding validation: ensure no invented figures
      validateAdvisoryGrounding(parsed.data, snapshot);

      const session = await deps.sessionRepository.createSession({
        userId,
        snapshotVersion: 1,
        model: deps.postureConfig.model ?? "mistral-small-latest",
        provider: posture.providerName,
        sessionData: {
          snapshot,
          analysis: parsed.data,
          generatedAt: new Date().toISOString(),
        },
      });

      return session;
    },

    async getLatestSession(userId) {
      return deps.sessionRepository.findLatestByUserId(userId);
    },

    async listSessions(userId) {
      const sessions = await deps.sessionRepository.listByUserId(userId);
      return {
        sessions,
        totalCount: sessions.length,
      };
    },
  };
}

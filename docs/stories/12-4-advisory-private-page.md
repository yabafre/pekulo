# Story: 12-4-advisory-private-page — Private advisory page (gated route + UI + disclaimer)

**Epic:** Epic 12 — Private internal AI advisory tool (internal / non-product)
**Status:** in-progress
**Source:** ticket
**Ticket:** #117
**Ticket URL:** https://github.com/yabafre/pekulo/issues/117
**Origin:** aped-story
**Branch:** feature/117-12-4-advisory-private-page

## User Story

**As an** authorized advisory user, **I want** a private page that shows my advisory analysis + recommendations, **so that** I can use the tool through the app behind the access gate.

## Acceptance Criteria

- **AC-1 (Rendered surface & regulatory notice — ADR-0016 §1/§2)** — **Given** an allowlisted user (`status: "active"` or `owner: true`), **When** they open `/dashboard/advisory`, **Then** the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
- **AC-2 (Server-side gate & zero data leak — ADR-0016 §4)** — **Given** a non-allowlisted or banned user (`status: "none"` or `"banned"`), **When** they navigate to `/dashboard/advisory`, **Then** they cannot reach the surface (server-side gate triggers `redirect("/dashboard")`, no advisory data leaks to the client, and all underlying Server Actions reject with 403 `FORBIDDEN`).
- **AC-3 (Provider & route transparency — ADR-0016 §3/§5)** — **Given** the rendered advisory page, **When** analysis and recommendations are shown, **Then** the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.
- **AC-4 (Private surface isolation — ADR-0016 §1)** — **Given** the public app navigation (`PekuloNavRail` and `PekuloMobileBottomNav`), **When** a user browses the app, **Then** the advisory page is not linked in the public navigation bars and is only reachable via direct URL `/dashboard/advisory` by authorized users.
- **AC-5 (Verification & non-regression)** — **Given** the web tier implementation, **When** tests, typecheck, and lint are run across `@pekulo/web`, **Then** each command exits 0 without error or regression.

## Tasks

- [x] **T1 — Register advisory cache keys and invalidation tag registry in `@pekulo/web`** [AC: AC-1, AC-3]
  Add `advisoryKeys` and `advisoryTags` in `apps/web/src/lib/zapaction/keys.ts`, and register the tag invalidation mapping in `setTagRegistry`. Add unit test in `apps/web/src/lib/zapaction/__tests__/advisory-registry.test.ts`.

  **Path:** `apps/web/src/lib/zapaction/keys.ts` (modify)
  Add `advisoryKeys` and `advisoryTags` definition:
  ```ts
  const ADVISORY_KEY = "advisory" as const;
  export const advisoryKeys = createFeatureKeys(ADVISORY_KEY, {
    status: () => ["status"] as const,
    latestSession: () => ["latestSession"] as const,
    snapshot: () => ["snapshot"] as const,
  });
  export const advisoryTags = createFeatureTags(ADVISORY_KEY, {
    session: () => ["session"] as const,
  });
  ```
  And in `setTagRegistry`:
  ```ts
  [advisoryTags.session()]: [advisoryKeys.latestSession(), advisoryKeys.snapshot()],
  ```

  **Path:** `apps/web/src/lib/zapaction/__tests__/advisory-registry.test.ts` (create)
  ```ts
  import { describe, expect, it } from "vitest";
  import { advisoryKeys, advisoryTags } from "../keys";

  describe("advisory zapaction registry keys and tags", () => {
    it("generates correct query keys", () => {
      expect(advisoryKeys.status()).toEqual(["advisory", "status"]);
      expect(advisoryKeys.latestSession()).toEqual(["advisory", "latestSession"]);
      expect(advisoryKeys.snapshot()).toEqual(["advisory", "snapshot"]);
    });

    it("generates correct invalidation tags", () => {
      expect(advisoryTags.session()).toBe("advisory:session");
    });
  });
  ```

  Run: `bun --filter=@pekulo/web run test src/lib/zapaction/__tests__/advisory-registry.test.ts`
  Expected: `✓ src/lib/zapaction/__tests__/advisory-registry.test.ts`, exit 0.
  Commit: `git add apps/web/src/lib/zapaction/keys.ts apps/web/src/lib/zapaction/__tests__/advisory-registry.test.ts && git commit -m "feat(#117): add advisory zapaction cache keys and tag registry"`

- [x] **T2 — Add advisory localization strings in `messages/fr.json` and `messages/en.json`** [AC: AC-1, AC-3]
  Add `"advisory"` namespace in both `fr.json` and `en.json` covering disclaimer, actions, empty states, overview, strengths, risks, allocation advice, recommendation badges, and provider posture.

  **Path:** `apps/web/messages/fr.json` (modify)
  Add under root object:
  ```json
  "advisory": {
    "title": "Conseil patrimonial IA — Espace Privé",
    "subtitle": "Analyse patrimoniale et recommandations d'arbitrage strictement confidentielles",
    "disclaimer": {
      "badge": "Outil interne privé",
      "title": "Avertissement réglementaire",
      "body": "Cet outil est strictement réservé à un usage interne et personnel au sein d'un cercle restreint autorisé. Il ne constitue en aucun cas un conseil en investissement réglementé (au sens du statut CIF ou de la directive MIF II), ni une incitation à négocier des instruments financiers."
    },
    "actions": {
      "generate": "Générer une analyse",
      "generating": "Analyse en cours…",
      "refresh": "Actualiser l'analyse"
    },
    "emptyState": {
      "title": "Aucune analyse disponible",
      "description": "Lancez votre première analyse patrimoniale privée pour générer un diagnostic complet et des recommandations d'arbitrage."
    },
    "sections": {
      "overview": "Synthèse générale",
      "strengths": "Points forts du patrimoine",
      "risks": "Points de vigilance & Risques",
      "allocationAdvice": "Stratégie d'allocation",
      "recommendations": "Recommandations d'arbitrage"
    },
    "recommendations": {
      "action": {
        "buy": "Achat",
        "sell": "Vente",
        "hold": "Conserver",
        "trim": "Alléger",
        "rebalance": "Rééquilibrer",
        "allocate": "Allouer",
        "reduce": "Réduire"
      },
      "priority": {
        "high": "Priorité Haute",
        "medium": "Priorité Moyenne",
        "low": "Priorité Basse"
      },
      "target": "Cible : {target}",
      "instrument": "Instrument proposé :",
      "rationale": "Justification :"
    },
    "providerBadge": {
      "posture": "Hébergement UE · Politique Zero Data Retention · Aucun entraînement",
      "model": "Modèle : {model}",
      "provider": "Fournisseur : {provider}",
      "generatedAt": "Généré le {date}"
    }
  }
  ```

  **Path:** `apps/web/messages/en.json` (modify)
  Add under root object:
  ```json
  "advisory": {
    "title": "AI Wealth Advisory — Private Area",
    "subtitle": "Strictly confidential wealth analysis and arbitrage recommendations",
    "disclaimer": {
      "badge": "Private internal tool",
      "title": "Regulatory notice",
      "body": "This tool is strictly restricted to private and internal use within an authorized circle. It does not constitute regulated investment advice (CIF / MiFID II) or an offer/solicitation to trade financial instruments."
    },
    "actions": {
      "generate": "Generate analysis",
      "generating": "Generating analysis…",
      "refresh": "Refresh analysis"
    },
    "emptyState": {
      "title": "No analysis available",
      "description": "Run your first private wealth analysis to generate a comprehensive diagnostic and arbitrage recommendations."
    },
    "sections": {
      "overview": "General overview",
      "strengths": "Wealth strengths",
      "risks": "Risks & Points of attention",
      "allocationAdvice": "Allocation strategy",
      "recommendations": "Arbitrage recommendations"
    },
    "recommendations": {
      "action": {
        "buy": "Buy",
        "sell": "Sell",
        "hold": "Hold",
        "trim": "Trim",
        "rebalance": "Rebalance",
        "allocate": "Allocate",
        "reduce": "Reduce"
      },
      "priority": {
        "high": "High Priority",
        "medium": "Medium Priority",
        "low": "Low Priority"
      },
      "target": "Target: {target}",
      "instrument": "Proposed instrument:",
      "rationale": "Rationale:"
    },
    "providerBadge": {
      "posture": "EU hosted · Zero Data Retention · No training posture",
      "model": "Model: {model}",
      "provider": "Provider: {provider}",
      "generatedAt": "Generated on {date}"
    }
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`
  Expected: Exit code 0.
  Commit: `git add apps/web/messages/fr.json apps/web/messages/en.json && git commit -m "feat(#117): add advisory i18n messages in French and English"`

- [x] **T3 — Create Advisory Server Actions wrapping oRPC client** [AC: AC-1, AC-2, AC-3]
  Create `advisory-actions.ts` using `@zapaction/core#defineAction` and `advisoryClient` from `@/lib/orpc/modules`. Create unit tests in `advisory-actions.test.ts`.

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.ts` (create)
  ```ts
  "use server";

  import { defineAction } from "@zapaction/core";
  import { z } from "@pekulo/zod";
  import {
    advisorySessionSchema,
    advisoryStatusSchema,
    generateAnalysisInputSchema,
    type AdvisorySession,
    type AdvisoryStatus,
    type GenerateAnalysisInput,
  } from "@pekulo/validators";
  import { advisoryClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  export const getAdvisoryStatus = defineAction<void, AdvisoryStatus, ActionContext>({
    name: "getAdvisoryStatus",
    input: z.void(),
    output: advisoryStatusSchema,
    handler: async () => {
      await ensureRequestContext();
      return advisoryClient.status();
    },
  });

  export const getLatestAdvisorySession = defineAction<void, AdvisorySession | null, ActionContext>({
    name: "getLatestAdvisorySession",
    input: z.void(),
    output: advisorySessionSchema.nullable(),
    handler: async () => {
      await ensureRequestContext();
      return advisoryClient.getLatestSession();
    },
  });

  export const generateAdvisoryAnalysis = defineAction<
    GenerateAnalysisInput,
    AdvisorySession,
    ActionContext
  >({
    name: "generateAdvisoryAnalysis",
    input: generateAnalysisInputSchema,
    output: advisorySessionSchema,
    handler: async (input) => {
      await ensureRequestContext();
      return advisoryClient.generateAnalysis(input);
    },
  });
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.test.ts` (create)
  ```ts
  import { describe, expect, it, vi, beforeEach } from "vitest";

  const mockStatus = vi.fn();
  const mockGetLatestSession = vi.fn();
  const mockGenerateAnalysis = vi.fn();

  vi.mock("@/lib/orpc/modules", () => ({
    advisoryClient: {
      status: (...args: unknown[]) => mockStatus(...args),
      getLatestSession: (...args: unknown[]) => mockGetLatestSession(...args),
      generateAnalysis: (...args: unknown[]) => mockGenerateAnalysis(...args),
    },
  }));

  vi.mock("@/lib/orpc/request-context", () => ({
    ensureRequestContext: vi.fn().mockResolvedValue(undefined),
  }));

  import {
    getAdvisoryStatus,
    getLatestAdvisorySession,
    generateAdvisoryAnalysis,
  } from "./advisory-actions";

  describe("advisory-actions", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("getAdvisoryStatus returns status from advisoryClient", async () => {
      mockStatus.mockResolvedValueOnce({ access: "active", owner: true });
      const res = await getAdvisoryStatus();
      expect(res).toEqual({ access: "active", owner: true });
      expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("getLatestAdvisorySession returns null when no session exists", async () => {
      mockGetLatestSession.mockResolvedValueOnce(null);
      const res = await getLatestAdvisorySession();
      expect(res).toBeNull();
      expect(mockGetLatestSession).toHaveBeenCalledTimes(1);
    });

    it("generateAdvisoryAnalysis forwards input to advisoryClient", async () => {
      const fakeSession = {
        id: "advs_123",
        userId: "11111111-1111-4111-8111-111111111111",
        snapshotVersion: 1,
        model: "claude-3-5-sonnet",
        provider: "anthropic",
        createdAt: "2026-10-27T18:00:00.000Z",
        updatedAt: "2026-10-27T18:00:00.000Z",
        sessionData: {
          snapshot: {
            asOf: "2026-10-27T18:00:00.000Z",
            wealth: { totalGross: 100000, totalDebt: 0, totalNet: 100000 },
            allocation: [],
            compass: { targetWealth: 200000, gap: 100000, onTrack: true },
            monthlyCashflow: { income: 3000, expenses: 2000, savings: 1000, savingsRate: 33.3 },
            portfolio: { totalValue: 50000, unrealizedGain: 5000, returnPct: 10 },
            positions: [],
            byKind: [],
            fiscalite: { totalTaxEstimate: 0, byAccount: [], computation: "none" },
            fx: { ratesUsed: {}, hasCrossCurrency: false },
          },
          analysis: {
            overview: "Solid financial base.",
            strengths: ["Strong savings rate"],
            risks: ["Equity concentration"],
            allocationAdvice: "Diversify across global ETFs.",
            recommendations: [],
          },
          generatedAt: "2026-10-27T18:00:00.000Z",
        },
      };
      mockGenerateAnalysis.mockResolvedValueOnce(fakeSession);

      const res = await generateAdvisoryAnalysis({ forceRefresh: true });
      expect(res).toEqual(fakeSession);
      expect(mockGenerateAnalysis).toHaveBeenCalledWith({ forceRefresh: true });
    });
  });
  ```

  Run: `bun --filter=@pekulo/web run test src/app/\(cap\)/dashboard/advisory/_actions/advisory-actions.test.ts`
  Expected: `✓ src/app/(cap)/dashboard/advisory/_actions/advisory-actions.test.ts`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/advisory/_actions/ && git commit -m "feat(#117): implement advisory server actions"`

- [x] **T4 — Create Advisory client hooks** [AC: AC-1, AC-3]
  Implement `useAdvisoryStatus`, `useAdvisoryLatestSession`, and `useGenerateAdvisoryAnalysis` in `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.ts` using `@zapaction/query`. Write unit tests in `use-advisory.test.tsx`.

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.ts` (create)
  ```ts
  "use client";

  import { useActionMutation, useActionQuery } from "@zapaction/query";
  import { advisoryKeys, advisoryTags } from "@/lib/zapaction/keys";
  import {
    getAdvisoryStatus,
    getLatestAdvisorySession,
    generateAdvisoryAnalysis,
  } from "../_actions/advisory-actions";

  export function useAdvisoryStatus() {
    return useActionQuery({
      action: getAdvisoryStatus,
      input: undefined,
      queryKey: advisoryKeys.status(),
      staleTime: 60_000,
    });
  }

  export function useAdvisoryLatestSession() {
    return useActionQuery({
      action: getLatestAdvisorySession,
      input: undefined,
      queryKey: advisoryKeys.latestSession(),
      staleTime: 5 * 60_000,
    });
  }

  export function useGenerateAdvisoryAnalysis() {
    return useActionMutation({
      action: generateAdvisoryAnalysis,
      invalidate: [advisoryTags.session()],
    });
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.test.tsx` (create)
  ```tsx
  import { describe, expect, it, vi } from "vitest";
  import { renderHook, waitFor } from "@testing-library/react";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import type { ReactNode } from "react";

  vi.mock("../_actions/advisory-actions", () => ({
    getAdvisoryStatus: vi.fn().mockResolvedValue({ access: "active", owner: true }),
    getLatestAdvisorySession: vi.fn().mockResolvedValue(null),
    generateAdvisoryAnalysis: vi.fn().mockResolvedValue({ id: "advs_test" }),
  }));

  import {
    useAdvisoryStatus,
    useAdvisoryLatestSession,
    useGenerateAdvisoryAnalysis,
  } from "./use-advisory";

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  describe("use-advisory hooks", () => {
    it("useAdvisoryStatus loads status", async () => {
      const { result } = renderHook(() => useAdvisoryStatus(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ access: "active", owner: true });
    });

    it("useAdvisoryLatestSession loads latest session", async () => {
      const { result } = renderHook(() => useAdvisoryLatestSession(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it("useGenerateAdvisoryAnalysis provides mutate method", () => {
      const { result } = renderHook(() => useGenerateAdvisoryAnalysis(), {
        wrapper: createWrapper(),
      });
      expect(typeof result.current.mutate).toBe("function");
    });
  });
  ```

  Run: `bun --filter=@pekulo/web run test src/app/\(cap\)/dashboard/advisory/_hooks/use-advisory.test.tsx`
  Expected: `✓ src/app/(cap)/dashboard/advisory/_hooks/use-advisory.test.tsx`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/advisory/_hooks/ && git commit -m "feat(#117): implement advisory react hooks"`

- [x] **T5 — Build Advisory subcomponents (Disclaimer, Provider Badge, Recommendation Card)** [AC: AC-1, AC-3]
  Create the 3 core presentational components: regulatory disclaimer, provider transparency badge, and recommendation card.

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-disclaimer.tsx` (create)
  ```tsx
  "use client";

  import { useTranslations } from "next-intl";
  import { ShieldAlert } from "lucide-react";
  import { Text, View } from "@pekulo/ui/client";

  export function AdvisoryDisclaimer() {
    const t = useTranslations("advisory");

    return (
      <View
        role="region"
        aria-label={t("disclaimer.title")}
        backgroundColor="$backgroundMuted"
        borderWidth={1}
        borderColor="$borderMuted"
        borderRadius="$md"
        padding="$4"
        flexDirection="column"
        gap="$2"
      >
        <View flexDirection="row" alignItems="center" gap="$2">
          <ShieldAlert size={18} color="var(--warning)" aria-hidden />
          <View
            backgroundColor="$warningMuted"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$xs"
          >
            <Text color="$warning" fontSize="$caption" fontWeight="bold">
              {t("disclaimer.badge")}
            </Text>
          </View>
          <Text color="$color" fontSize="$body" fontWeight="bold">
            {t("disclaimer.title")}
          </Text>
        </View>
        <Text color="$colorSecondary" fontSize="$caption" lineHeight="$sm">
          {t("disclaimer.body")}
        </Text>
      </View>
    );
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-provider-badge.tsx` (create)
  ```tsx
  "use client";

  import { useTranslations } from "next-intl";
  import { Cpu, ShieldCheck } from "lucide-react";
  import { Text, View } from "@pekulo/ui/client";

  export interface AdvisoryProviderBadgeProps {
    provider: string;
    model: string;
    generatedAt?: string;
  }

  export function AdvisoryProviderBadge({
    provider,
    model,
    generatedAt,
  }: AdvisoryProviderBadgeProps) {
    const t = useTranslations("advisory.providerBadge");

    const formattedDate = generatedAt
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(generatedAt))
      : null;

    return (
      <View
        role="note"
        aria-label={t("posture")}
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        gap="$2"
        paddingHorizontal="$2.5"
        paddingVertical="$1.5"
        backgroundColor="$backgroundMuted"
        borderWidth={1}
        borderColor="$borderMuted"
        borderRadius="$sm"
      >
        <View flexDirection="row" alignItems="center" gap="$1.5">
          <Cpu size={14} color="var(--colorSecondary)" aria-hidden />
          <Text color="$colorSecondary" fontSize="$caption" fontWeight="medium">
            {provider} / {model}
          </Text>
        </View>

        <Text color="$colorTertiary" fontSize="$caption">
          ·
        </Text>

        <View flexDirection="row" alignItems="center" gap="$1.5">
          <ShieldCheck size={14} color="var(--positive)" aria-hidden />
          <Text color="$colorSecondary" fontSize="$caption">
            {t("posture")}
          </Text>
        </View>

        {formattedDate && (
          <>
            <Text color="$colorTertiary" fontSize="$caption">
              ·
            </Text>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("generatedAt", { date: formattedDate })}
            </Text>
          </>
        )}
      </View>
    );
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-recommendation-card.tsx` (create)
  ```tsx
  "use client";

  import { useTranslations } from "next-intl";
  import type { AdvisoryRecommendation } from "@pekulo/validators";
  import { ArrowRight, Tag } from "lucide-react";
  import { Text, View } from "@pekulo/ui/client";
  import { AdvisoryProviderBadge } from "./advisory-provider-badge";

  export interface AdvisoryRecommendationCardProps {
    recommendation: AdvisoryRecommendation;
    provider: string;
    model: string;
  }

  export function AdvisoryRecommendationCard({
    recommendation,
    provider,
    model,
  }: AdvisoryRecommendationCardProps) {
    const t = useTranslations("advisory.recommendations");

    const actionColors: Record<
      string,
      { bg: "$positiveMuted" | "$negativeMuted" | "$warningMuted" | "$backgroundMuted"; color: string }
    > = {
      buy: { bg: "$positiveMuted", color: "var(--positive)" },
      sell: { bg: "$negativeMuted", color: "var(--negative)" },
      trim: { bg: "$warningMuted", color: "var(--warning)" },
      reduce: { bg: "$warningMuted", color: "var(--warning)" },
      hold: { bg: "$backgroundMuted", color: "var(--colorSecondary)" },
      rebalance: { bg: "$backgroundMuted", color: "var(--color)" },
      allocate: { bg: "$positiveMuted", color: "var(--positive)" },
    };

    const actionStyle = actionColors[recommendation.action] ?? {
      bg: "$backgroundMuted",
      color: "var(--colorSecondary)",
    };

    return (
      <View
        backgroundColor="$backgroundElevated"
        borderWidth={1}
        borderColor="$borderMuted"
        borderRadius="$md"
        padding="$4"
        flexDirection="column"
        gap="$3"
      >
        <View
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          flexWrap="wrap"
          gap="$2"
        >
          <View flexDirection="row" alignItems="center" gap="$2" flexWrap="wrap">
            <View
              backgroundColor={actionStyle.bg}
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$xs"
            >
              <Text style={{ color: actionStyle.color }} fontSize="$caption" fontWeight="bold">
                {t(`action.${recommendation.action}`)}
              </Text>
            </View>
            <Text color="$color" fontSize="$body" fontWeight="bold">
              {recommendation.title}
            </Text>
          </View>

          <View
            backgroundColor="$backgroundMuted"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$xs"
          >
            <Text color="$colorSecondary" fontSize="$caption">
              {t(`priority.${recommendation.priority}`)}
            </Text>
          </View>
        </View>

        <View flexDirection="row" alignItems="center" gap="$2">
          <Tag size={14} color="var(--colorSecondary)" aria-hidden />
          <Text color="$colorSecondary" fontSize="$caption">
            {t("target", { target: recommendation.target })}
          </Text>
        </View>

        <View flexDirection="column" gap="$1">
          <Text color="$colorTertiary" fontSize="$caption" fontWeight="medium">
            {t("rationale")}
          </Text>
          <Text color="$color" fontSize="$body" lineHeight="$sm">
            {recommendation.rationale}
          </Text>
        </View>

        {recommendation.instrumentRecommendation && (
          <View
            backgroundColor="$backgroundMuted"
            borderRadius="$sm"
            padding="$3"
            flexDirection="column"
            gap="$2"
          >
            <View flexDirection="row" alignItems="center" gap="$2">
              <ArrowRight size={14} color="var(--color)" aria-hidden />
              <Text color="$color" fontSize="$caption" fontWeight="bold">
                {t("instrument")}{" "}
                {recommendation.instrumentRecommendation.symbol}
                {recommendation.instrumentRecommendation.isin
                  ? ` (${recommendation.instrumentRecommendation.isin})`
                  : ""}
              </Text>
            </View>
            <Text color="$colorSecondary" fontSize="$caption">
              {recommendation.instrumentRecommendation.rationale}
            </Text>
          </View>
        )}

        <View marginTop="$1">
          <AdvisoryProviderBadge provider={provider} model={model} />
        </View>
      </View>
    );
  }
  ```

  Run: `bun --filter=@pekulo/web run typecheck`
  Expected: Exit code 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/advisory/_components/advisory-disclaimer.tsx apps/web/src/app/\(cap\)/dashboard/advisory/_components/advisory-provider-badge.tsx apps/web/src/app/\(cap\)/dashboard/advisory/_components/advisory-recommendation-card.tsx && git commit -m "feat(#117): add advisory disclaimer, provider badge, and recommendation card"`

- [x] **T6 — Build main Advisory View, Loading Skeleton & Error Boundary** [AC: AC-1, AC-3]
  Assemble the view with generation trigger, empty state, analysis overview, strengths/risks sections, allocation strategy, and recommendations list. Write comprehensive component tests in `advisory-view.test.tsx`. Add `loading.tsx` and `error.tsx`.

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.tsx` (create)
  ```tsx
  "use client";

  import { useTranslations } from "next-intl";
  import type { AdvisoryStatus } from "@pekulo/validators";
  import { PekuloButton, PekuloEmptyState } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { Sparkles, CheckCircle2, AlertTriangle, PieChart } from "lucide-react";
  import { useAdvisoryLatestSession, useGenerateAdvisoryAnalysis } from "../_hooks/use-advisory";
  import { AdvisoryDisclaimer } from "./advisory-disclaimer";
  import { AdvisoryProviderBadge } from "./advisory-provider-badge";
  import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";

  export interface AdvisoryViewProps {
    initialStatus: AdvisoryStatus;
  }

  export function AdvisoryView({ initialStatus: _ }: AdvisoryViewProps) {
    const t = useTranslations("advisory");
    const { data: session, isLoading } = useAdvisoryLatestSession();
    const generateMutation = useGenerateAdvisoryAnalysis();

    const handleGenerate = () => {
      generateMutation.mutate({ forceRefresh: true });
    };

    return (
      <View
        flexDirection="column"
        gap="$6"
        width="100%"
        maxWidth={880}
        alignSelf="center"
        paddingBottom="$8"
      >
        <AdvisoryDisclaimer />

        <View
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap="$4"
        >
          <View flexDirection="column" gap="$1">
            <Text color="$color" fontSize="$title" fontWeight="bold">
              {t("title")}
            </Text>
            <Text color="$colorSecondary" fontSize="$caption">
              {t("subtitle")}
            </Text>
          </View>

          <PekuloButton
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="font_body"
          >
            <View flexDirection="row" alignItems="center" gap="$2">
              <Sparkles size={16} color="currentColor" aria-hidden />
              <Text color="currentColor" fontSize="$body" fontWeight="medium">
                {generateMutation.isPending
                  ? t("actions.generating")
                  : session
                    ? t("actions.refresh")
                    : t("actions.generate")}
              </Text>
            </View>
          </PekuloButton>
        </View>

        {session && (
          <AdvisoryProviderBadge
            provider={session.provider}
            model={session.model}
            generatedAt={session.createdAt}
          />
        )}

        {isLoading ? (
          <View padding="$8" alignItems="center">
            <Text color="$colorSecondary">{t("actions.generating")}</Text>
          </View>
        ) : !session ? (
          <PekuloEmptyState
            title={t("emptyState.title")}
            description={t("emptyState.description")}
            actionLabel={t("actions.generate")}
            onAction={handleGenerate}
          />
        ) : (
          <View flexDirection="column" gap="$5">
            {/* Overview */}
            <View
              backgroundColor="$backgroundElevated"
              borderWidth={1}
              borderColor="$borderMuted"
              borderRadius="$md"
              padding="$4"
              flexDirection="column"
              gap="$2"
            >
              <Text color="$color" fontSize="$body" fontWeight="bold">
                {t("sections.overview")}
              </Text>
              <Text color="$colorSecondary" fontSize="$body" lineHeight="$sm">
                {session.sessionData.analysis.overview}
              </Text>
            </View>

            {/* Strengths & Risks */}
            <View
              flexDirection="row"
              gap="$4"
              $max-md={{ flexDirection: "column" }}
            >
              <View
                flex={1}
                backgroundColor="$backgroundElevated"
                borderWidth={1}
                borderColor="$borderMuted"
                borderRadius="$md"
                padding="$4"
                flexDirection="column"
                gap="$2"
              >
                <View flexDirection="row" alignItems="center" gap="$2">
                  <CheckCircle2 size={16} color="var(--positive)" aria-hidden />
                  <Text color="$color" fontSize="$body" fontWeight="bold">
                    {t("sections.strengths")}
                  </Text>
                </View>
                {session.sessionData.analysis.strengths.map((str, idx) => (
                  <Text key={idx} color="$colorSecondary" fontSize="$caption">
                    • {str}
                  </Text>
                ))}
              </View>

              <View
                flex={1}
                backgroundColor="$backgroundElevated"
                borderWidth={1}
                borderColor="$borderMuted"
                borderRadius="$md"
                padding="$4"
                flexDirection="column"
                gap="$2"
              >
                <View flexDirection="row" alignItems="center" gap="$2">
                  <AlertTriangle size={16} color="var(--warning)" aria-hidden />
                  <Text color="$color" fontSize="$body" fontWeight="bold">
                    {t("sections.risks")}
                  </Text>
                </View>
                {session.sessionData.analysis.risks.map((risk, idx) => (
                  <Text key={idx} color="$colorSecondary" fontSize="$caption">
                    • {risk}
                  </Text>
                ))}
              </View>
            </View>

            {/* Allocation Advice */}
            <View
              backgroundColor="$backgroundElevated"
              borderWidth={1}
              borderColor="$borderMuted"
              borderRadius="$md"
              padding="$4"
              flexDirection="column"
              gap="$2"
            >
              <View flexDirection="row" alignItems="center" gap="$2">
                <PieChart size={16} color="var(--color)" aria-hidden />
                <Text color="$color" fontSize="$body" fontWeight="bold">
                  {t("sections.allocationAdvice")}
                </Text>
              </View>
              <Text color="$colorSecondary" fontSize="$body" lineHeight="$sm">
                {session.sessionData.analysis.allocationAdvice}
              </Text>
            </View>

            {/* Recommendations List */}
            <View flexDirection="column" gap="$3">
              <Text color="$color" fontSize="$body" fontWeight="bold">
                {t("sections.recommendations")} (
                {session.sessionData.analysis.recommendations.length})
              </Text>
              {session.sessionData.analysis.recommendations.map((rec) => (
                <AdvisoryRecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  provider={session.provider}
                  model={session.model}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.test.tsx` (create)
  ```tsx
  import { describe, expect, it, vi } from "vitest";
  import { render, screen, fireEvent } from "@testing-library/react";
  import { NextIntlClientProvider } from "next-intl";
  import messages from "../../../../../../messages/fr.json";
  import { AdvisoryView } from "./advisory-view";

  const mockMutate = vi.fn();
  let mockSession: unknown = null;
  let mockIsLoading = false;

  vi.mock("../_hooks/use-advisory", () => ({
    useAdvisoryLatestSession: () => ({
      data: mockSession,
      isLoading: mockIsLoading,
    }),
    useGenerateAdvisoryAnalysis: () => ({
      mutate: mockMutate,
      isPending: false,
    }),
  }));

  function renderView() {
    return render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <AdvisoryView initialStatus={{ access: "active", owner: true }} />
      </NextIntlClientProvider>,
    );
  }

  describe("AdvisoryView", () => {
    it("renders regulatory disclaimer banner (AC-1)", () => {
      mockSession = null;
      renderView();
      expect(
        screen.getByRole("region", { name: "Avertissement réglementaire" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/ne constitue en aucun cas un conseil en investissement réglementé/i),
      ).toBeInTheDocument();
    });

    it("renders empty state when no session exists and triggers generate", () => {
      mockSession = null;
      renderView();
      expect(screen.getByText("Aucune analyse disponible")).toBeInTheDocument();
      const generateBtns = screen.getAllByRole("button", { name: /Générer une analyse/i });
      fireEvent.click(generateBtns[0]!);
      expect(mockMutate).toHaveBeenCalledWith({ forceRefresh: true });
    });

    it("renders session overview and recommendations with provider badge (AC-1, AC-3)", () => {
      mockSession = {
        id: "advs_1",
        userId: "11111111-1111-4111-8111-111111111111",
        snapshotVersion: 1,
        model: "claude-3-5-sonnet",
        provider: "anthropic",
        createdAt: "2026-10-27T18:00:00.000Z",
        updatedAt: "2026-10-27T18:00:00.000Z",
        sessionData: {
          snapshot: {},
          analysis: {
            overview: "Portefeuille résilient avec 60% actions.",
            strengths: ["Bonne épargne de sécurité"],
            risks: ["Exposition USD"],
            allocationAdvice: "Renforcer les obligations d'État européennes.",
            recommendations: [
              {
                id: "rec_1",
                title: "Acheter ETF Obligations",
                action: "buy",
                target: "Obligations",
                rationale: "Stabiliser la volatilité.",
                priority: "high",
                instrumentRecommendation: {
                  symbol: "AGGH",
                  isin: "IE00BDBRDM35",
                  action: "buy",
                  rationale: "ETF global agrégé hedgé EUR.",
                },
              },
            ],
          },
          generatedAt: "2026-10-27T18:00:00.000Z",
        },
      };

      renderView();

      expect(screen.getByText("Portefeuille résilient avec 60% actions.")).toBeInTheDocument();
      expect(screen.getByText("Acheter ETF Obligations")).toBeInTheDocument();
      expect(screen.getByText(/AGGH/)).toBeInTheDocument();
      expect(screen.getAllByText(/anthropic \/ claude-3-5-sonnet/i).length).toBeGreaterThan(0);
    });
  });
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/loading.tsx` (create)
  ```tsx
  import { PekuloSkeleton } from "@pekulo/ui";

  export default function AdvisoryLoading() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "16px 8px", width: "100%", maxWidth: 880, margin: "0 auto" }}>
        <PekuloSkeleton height={100} borderRadius={8} />
        <PekuloSkeleton height={48} width="60%" borderRadius={8} />
        <PekuloSkeleton height={180} borderRadius={8} />
        <PekuloSkeleton height={240} borderRadius={8} />
      </div>
    );
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/error.tsx` (create)
  ```tsx
  "use client";

  import { useEffect } from "react";
  import { PekuloButton } from "@pekulo/ui";
  import { AlertTriangle } from "lucide-react";

  export default function AdvisoryError({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      // Log error for client observability
    }, [error]);

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 48, textAlign: "center" }}>
        <AlertTriangle size={36} color="var(--negative)" />
        <h2 style={{ fontSize: 18, fontWeight: "bold" }}>Une erreur est survenue lors du chargement de l'espace conseil.</h2>
        <PekuloButton variant="primary" onClick={reset}>
          Réessayer
        </PekuloButton>
      </div>
    );
  }
  ```

  Run: `bun --filter=@pekulo/web run test src/app/\(cap\)/dashboard/advisory/_components/advisory-view.test.tsx`
  Expected: `✓ src/app/(cap)/dashboard/advisory/_components/advisory-view.test.tsx`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/advisory/_components/advisory-view.tsx apps/web/src/app/\(cap\)/dashboard/advisory/_components/advisory-view.test.tsx apps/web/src/app/\(cap\)/dashboard/advisory/loading.tsx apps/web/src/app/\(cap\)/dashboard/advisory/error.tsx && git commit -m "feat(#117): implement advisory view, loading skeleton, and error boundary"`

- [x] **T7 — Implement Server Component Route with Server-Side Access Gate** [AC: AC-1, AC-2]
  Implement `apps/web/src/app/(cap)/dashboard/advisory/page.tsx` as a Server Component enforcing the server-side gate via `advisoryClient.status()`. Redirect unauthorized or banned users immediately to `/dashboard` without leaking any advisory data. Unit test in `page.test.tsx`.

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/page.tsx` (create)
  ```tsx
  import { redirect } from "next/navigation";
  import { advisoryClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import { AdvisoryView } from "./_components/advisory-view";

  export default async function AdvisoryPage() {
    await ensureRequestContext();

    let status;
    try {
      status = await advisoryClient.status();
    } catch {
      redirect("/dashboard");
    }

    if (!status || status.access !== "active") {
      redirect("/dashboard");
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          padding: "16px 8px 0",
          width: "100%",
        }}
      >
        <AdvisoryView initialStatus={status} />
      </div>
    );
  }
  ```

  **Path:** `apps/web/src/app/(cap)/dashboard/advisory/page.test.tsx` (create)
  ```tsx
  import { describe, expect, it, vi, beforeEach } from "vitest";

  const mockStatus = vi.fn();
  const mockRedirect = vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });

  vi.mock("next/navigation", () => ({
    redirect: (path: string) => mockRedirect(path),
  }));

  vi.mock("@/lib/orpc/modules", () => ({
    advisoryClient: {
      status: () => mockStatus(),
    },
  }));

  vi.mock("@/lib/orpc/request-context", () => ({
    ensureRequestContext: vi.fn().mockResolvedValue(undefined),
  }));

  vi.mock("./_components/advisory-view", () => ({
    AdvisoryView: () => <div data-testid="advisory-view" />,
  }));

  import AdvisoryPage from "./page";

  describe("AdvisoryPage Server Component Gate", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders AdvisoryView for active allowlisted user (AC-1)", async () => {
      mockStatus.mockResolvedValueOnce({ access: "active", owner: false });
      const jsx = await AdvisoryPage();
      expect(jsx).toBeDefined();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects to /dashboard for non-allowlisted user with access none (AC-2)", async () => {
      mockStatus.mockResolvedValueOnce({ access: "none", owner: false });
      await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to /dashboard for banned user (AC-2)", async () => {
      mockStatus.mockResolvedValueOnce({ access: "banned", owner: false });
      await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to /dashboard when oRPC status throws 403 (AC-2)", async () => {
      mockStatus.mockRejectedValueOnce(new Error("FORBIDDEN: advisory access required"));
      await expect(AdvisoryPage()).rejects.toThrow("REDIRECT:/dashboard");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    });
  });
  ```

  Run: `bun --filter=@pekulo/web run test src/app/\(cap\)/dashboard/advisory/page.test.tsx`
  Expected: `✓ src/app/(cap)/dashboard/advisory/page.test.tsx`, exit 0.
  Commit: `git add apps/web/src/app/\(cap\)/dashboard/advisory/page.tsx apps/web/src/app/\(cap\)/dashboard/advisory/page.test.tsx && git commit -m "feat(#117): implement server-side gated advisory page route"`

- [x] **T8 — Full test suite, lint and typecheck verification across `@pekulo/web`** [AC: AC-5]
  Execute all validation commands for the web tier and ensure clean passes across the entire project.

  Run commands:
  ```bash
  bun --filter=@pekulo/web run typecheck
  bun --filter=@pekulo/web run lint
  bun --filter=@pekulo/web run test
  ```
  Expected: All exit 0 with 0 errors.
  Commit: `git add docs/stories/12-4-advisory-private-page.md docs/state.yaml && git commit -m "chore(#117): 12-4-advisory-private-page ready for dev"`

## Dev Notes

- **Architecture:** Isolated private internal advisory surface per ADR-0016 §1 / §2 / §4. Inherits the `CapShell` authenticated layout under `apps/web/src/app/(cap)/dashboard/` (lesson 2026-05-27). Server Component performs server-side access gate via `advisoryClient.status()` rejecting unauthorized or banned users with `redirect("/dashboard")` before any advisory data reaches the client bundle (AC-2). Client View renders the mandatory regulatory notice ("not regulated advice") and transparency badge (active model/provider and EU posture).
- **Files:**
  - `apps/web/src/lib/zapaction/keys.ts`
  - `apps/web/src/lib/zapaction/__tests__/advisory-registry.test.ts`
  - `apps/web/messages/fr.json`
  - `apps/web/messages/en.json`
  - `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.ts`
  - `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.test.ts`
  - `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.ts`
  - `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.test.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-disclaimer.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-provider-badge.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-recommendation-card.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.test.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/loading.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/error.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/page.tsx`
  - `apps/web/src/app/(cap)/dashboard/advisory/page.test.tsx`
- **Testing:** `bun --filter=@pekulo/web run test` (Vitest with Testing Library & React Query testing wrapper).
- **Dependencies:** `@pekulo/contracts`, `@pekulo/validators`, `@zapaction/core`, `@zapaction/query`, `@pekulo/ui`, `lucide-react`, `next-intl`.

### Step 0: Existing code at write time

`apps/web/src/lib/zapaction/keys.ts:54-63` (current):
```ts
export const llmKeys = createFeatureKeys("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
  activityLog: () => ["activityLog"] as const,
});
export const llmTags = createFeatureTags("llm", {
  optIn: () => ["optIn"] as const,
  aiNotice: () => ["aiNotice"] as const,
});
```

`apps/web/src/lib/zapaction/keys.ts:299-306` (current):
```ts
  [bankConnectionsTags.list()]: [
    bankConnectionsKeys.list(),
    [TRANSACTIONS_KEY],
    accountsKeys.list(),
    [MONTHLY_KEY],
    dashboardKeys.overview(),
  ],
});
```

### 3-Bullet File Decision Template

- **`apps/web/src/lib/zapaction/keys.ts`**
  - *Single responsibility:* Declare TanStack query keys and invalidation tags for the web tier cache.
  - *Inputs + outputs:* Imports `createFeatureKeys`, `createFeatureTags`; exports `advisoryKeys`, `advisoryTags`, updates `setTagRegistry`.
- **`apps/web/messages/fr.json` & `en.json`**
  - *Single responsibility:* Provide user-facing localized strings for the advisory disclaimer, actions, sections, and badges.
  - *Inputs + outputs:* JSON dictionary consumed by `next-intl`.
- **`apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.ts`**
  - *Single responsibility:* Wrap oRPC advisory procedures as Next.js Server Actions with request context injection.
  - *Inputs + outputs:* Imports `advisoryClient`, `@/lib/orpc/request-context`; exports `getAdvisoryStatus`, `getLatestAdvisorySession`, `generateAdvisoryAnalysis`.
- **`apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.ts`**
  - *Single responsibility:* Provide typed React hooks wrapping advisory Server Actions with cache synchronization.
  - *Inputs + outputs:* Imports actions and keys/tags; exports `useAdvisoryStatus`, `useAdvisoryLatestSession`, `useGenerateAdvisoryAnalysis`.
- **`apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-disclaimer.tsx`**
  - *Single responsibility:* Render the mandatory regulatory notice ("Outil interne privé — ne constitue pas un conseil en investissement réglementé").
  - *Inputs + outputs:* Consumes `next-intl` and `@pekulo/ui`; renders disclaimer banner.
- **`apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-provider-badge.tsx`**
  - *Single responsibility:* Display provider/model transparency, EU sovereignty posture, and timestamp.
  - *Inputs + outputs:* Takes `provider`, `model`, `generatedAt`; renders badge chip.
- **`apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-recommendation-card.tsx`**
  - *Single responsibility:* Render an individual arbitrage recommendation card with action pill, target, rationale, instrument details, and provider badge.
  - *Inputs + outputs:* Takes `recommendation`, `provider`, `model`; renders recommendation card.
- **`apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.tsx`**
  - *Single responsibility:* Client view assembling header actions, disclaimer, overview, strengths/risks, allocation advice, and recommendation cards.
  - *Inputs + outputs:* Consumes `useAdvisoryLatestSession`, `useGenerateAdvisoryAnalysis`; renders complete advisory dashboard.
- **`apps/web/src/app/(cap)/dashboard/advisory/loading.tsx` & `error.tsx`**
  - *Single responsibility:* Provide route-level Next.js loading skeleton and error boundary.
  - *Inputs + outputs:* Next.js App Router conventions.
- **`apps/web/src/app/(cap)/dashboard/advisory/page.tsx`**
  - *Single responsibility:* Server Component enforcing the server-side gate (redirects unauthorized users to `/dashboard`) and mounting `AdvisoryView`.
  - *Inputs + outputs:* Checks `advisoryClient.status()`; redirects or renders `AdvisoryView`.

## File List

- `apps/web/src/lib/zapaction/keys.ts`
- `apps/web/src/lib/zapaction/__tests__/advisory-registry.test.ts`
- `apps/web/messages/fr.json`
- `apps/web/messages/en.json`
- `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.ts`
- `apps/web/src/app/(cap)/dashboard/advisory/_actions/advisory-actions.test.ts`
- `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.ts`
- `apps/web/src/app/(cap)/dashboard/advisory/_hooks/use-advisory.test.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-disclaimer.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-provider-badge.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-recommendation-card.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/_components/advisory-view.test.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/loading.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/error.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/page.tsx`
- `apps/web/src/app/(cap)/dashboard/advisory/page.test.tsx`

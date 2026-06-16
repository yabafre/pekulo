"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { LlmOutcome, LlmRoute } from "@pekulo/types";
import { Text, View } from "@pekulo/ui/client";
import { PekuloPagination, Section } from "@pekulo/ui";
import { useLlmActivityLog } from "../_hooks/use-llm-activity-log";

// Story 6-5 (FR-36) — the 90-day LLM activity log. Read-only paginated list of
// COMPLETED calls (route + latency + outcome + time). NEVER renders prompt
// content (NFR-26 / AC-2) — the DTO carries none. Pagination is CLIENT-side over
// the bounded server window (≤200 rows, 90-day filter): the list cannot grow
// unbounded, so no offset/cursor round-trip is needed (decision step-04).
const PAGE_SIZE = 10;

// Domain route enum (foundation_models | ollama | third_party) → user label.
// NOT @pekulo/types#LlmRouteBadge (ios|ollama|cloud) — that DS variant is the
// suggestion-row badge; the audit log stores the domain enum. Grayscale text
// only (lesson 2026-05-07: $accent/$success/$danger reserved for ± € deltas,
// AC-6).
const ROUTE_LABEL: Record<LlmRoute, string> = {
  foundation_models: "iOS",
  ollama: "Ollama",
  third_party: "Cloud",
};
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

export function LlmActivityLog() {
  const t = useTranslations("llm");
  const OUTCOME_LABEL: Record<LlmOutcome, string> = {
    success: t("activityLog.outcomeSuccess"),
    failure: t("activityLog.outcomeFailure"),
    overridden: t("activityLog.outcomeOverridden"),
  };
  const { data, isLoading, error } = useLlmActivityLog();
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => setIsHydrated(true), []);
  const [page, setPage] = useState(1);
  // R13 (lesson 2026-05-24): gate the time-dependent date format + the
  // list/skeleton branch on a hydration flag so SSR and the first client paint
  // render the SAME tree (the loading branch) — the list (with locale-tz dates)
  // only mounts after the effect, never during hydration.
  const showLoading = !isHydrated || isLoading;

  const items = useMemo(() => data?.items ?? [], [data]);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Section title={t("activityLog.title")} ariaLabel={t("activityLog.ariaLabel")}>
      {showLoading && (
        // Visually-hidden live region so AT hears the load (mirrors
        // llm-opt-in-toggle.tsx). No <Suspense> here — useActionQuery surfaces
        // loading via isLoading and never throws (lesson 2026-05-26).
        <View
          role="status"
          aria-live="polite"
          position="absolute"
          width={1}
          height={1}
          overflow="hidden"
        >
          <Text color="$colorTertiary" fontSize="$caption">
            {t("activityLog.loading")}
          </Text>
        </View>
      )}
      {error && !showLoading && (
        <Text role="alert" color="$danger" fontSize="$caption">
          {error.message}
        </Text>
      )}
      {!showLoading && !error && items.length === 0 && (
        <Text color="$colorTertiary" fontSize="$caption">
          {t("activityLog.empty")}
        </Text>
      )}
      {!showLoading && !error && items.length > 0 && (
        <View role="list" flexDirection="column" gap="$2">
          {pageItems.map((entry) => (
            <View
              key={entry.id}
              role="listitem"
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              paddingVertical="$2"
            >
              <Text color="$color" fontSize="$caption">
                {ROUTE_LABEL[entry.route]}
              </Text>
              <Text color="$colorSecondary" fontSize="$caption">
                {entry.latencyMs == null ? "—" : `${entry.latencyMs} ms`}
              </Text>
              <Text color="$colorSecondary" fontSize="$caption">
                {/* `outcome` is a free-form String column (llm.prisma), not a
                    Prisma enum — a value outside LLM_OUTCOMES would key-miss the
                    label map and render `undefined`. Unreachable via the real
                    pipeline (the output schema validates the enum) but guarded
                    belt-and-suspenders against an out-of-band DB write. */}
                {entry.outcome == null ? "—" : (OUTCOME_LABEL[entry.outcome] ?? "—")}
              </Text>
              <Text color="$colorTertiary" fontSize="$caption">
                {dateTimeFmt.format(new Date(entry.occurredAt))}
              </Text>
            </View>
          ))}
        </View>
      )}
      {!showLoading && !error && pageCount > 1 && (
        <PekuloPagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={(p) => setPage(p)}
          ariaLabel={t("activityLog.paginationAriaLabel")}
        />
      )}
    </Section>
  );
}

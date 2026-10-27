"use client";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { useActionMutation, useActionQuery } from "@zapaction/query";
import { advisoryKeys, advisoryTags } from "@/lib/zapaction/keys";
import {
  getAdvisoryStatus,
  getLatestAdvisorySession,
  generateAdvisoryAnalysis,
} from "../_actions/advisory-actions";

export function useAdvisoryStatus() {
  return useActionQuery(getAdvisoryStatus, {
    input: undefined,
    queryKey: advisoryKeys.status(),
    readPolicy: "read-only",
    staleTime: 60_000,
  });
}

export function useAdvisoryLatestSession() {
  return useActionQuery(getLatestAdvisorySession, {
    input: undefined,
    queryKey: advisoryKeys.latestSession(),
    readPolicy: "read-only",
    staleTime: 5 * 60_000,
  });
}

export function useGenerateAdvisoryAnalysis() {
  return useActionMutation(generateAdvisoryAnalysis, {
    invalidateWithTags: [advisoryTags.session()],
  });
}

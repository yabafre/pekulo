"use client";

import { useActionMutation } from "@zapaction/query";
import { upsertMonthly } from "../_actions/monthly-actions";
import { monthlyTags } from "@/lib/zapaction/keys";

// Lesson 2026-05-24 (R12): pass invalidateWithTags on the hook — Next.js's
// "use server" boundary strips the .tags property attached by defineAction
// on the client, so client-side invalidation depends on this prop.
export function useUpsertMonthly(year: number, monthNum: number) {
  return useActionMutation(upsertMonthly, {
    invalidateWithTags: [monthlyTags.get(year, monthNum)],
  });
}

"use client";

// 5-5 AC-1 / AC-6. Registry-SSOT shape (lesson 2026-05-25): no optimistic
// onMutate recipe — the tag-registry edge ([monthlyTags.all()]: [[MONTHLY_KEY]])
// fans out to every monthly cache slot on success. Lesson 2026-05-24: pass
// tags through `invalidateWithTags` on the hook, NOT defineAction({ tags })
// which is server-only.

import { useActionMutation } from "@zapaction/query";
import { signOffMonthly } from "../_actions/monthly-actions";
import { monthlyTags } from "@/lib/zapaction/keys";

export function useSignOffMonthly() {
  return useActionMutation(signOffMonthly, {
    invalidateWithTags: [monthlyTags.all()],
  });
}

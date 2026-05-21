"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import { REALESTATE_KEY } from "@/lib/zapaction/keys";
import { createProperty } from "../_actions/realestate-actions";

// Bug-fix 2026-05-21 — registry-only invalidation surfaced as silently
// stale after first-load in dev (data updated on disk, refetch never
// triggered on the client). The zapaction `tags: [realestateTags.list()]`
// edge fires `invalidateQueries({ queryKey: ['realestate', 'list'] })`
// which only prefix-matches `realestateKeys.list()` — `useProperty(id)`
// (`['realestate', 'byId', id]`) and `useListValuations(id)`
// (`['realestate', 'valuations', id]`) miss. Explicit feature-prefix
// invalidation on success catches all 4 read consumers in one shot.
export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useActionMutation(createProperty, {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [REALESTATE_KEY] });
    },
  });
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionMutation } from "@zapaction/query";
import type { Milestone } from "@pekulo/validators";
import { milestonesKeys, milestonesTags } from "@/lib/zapaction/keys";
import { deleteMilestone } from "../_actions/milestones-actions";

// Optimistic delete. Pattern: cancel → snapshot → optimistic apply → rollback
// on thrown error → registry invalidates the milestones list + compass.setup
// on success (no manual onSettled needed; the tag registry covers both keys).
//
// `useQueryClient` is retained for cache-direct manipulation inside the
// optimistic hooks per the ZapAction optimistic-update recipe.
export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useActionMutation(deleteMilestone, {
    invalidateWithTags: [milestonesTags.list()],
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: milestonesKeys.list() });
      const previous = queryClient.getQueryData<Milestone[]>(milestonesKeys.list());
      queryClient.setQueryData<Milestone[]>(
        milestonesKeys.list(),
        (old) => old?.filter((mil) => mil.id !== input.id) ?? [],
      );
      return { previous };
    },
    onError: (_err, input, ctx) => {
      // Surgical restore: only re-add the row this mutation removed. Two
      // concurrent deletes each capture independent `previous` snapshots; a
      // blanket overwrite would resurrect the other mutation's deleted row.
      const removed = ctx?.previous?.find((mil) => mil.id === input.id);
      if (!removed) return;
      queryClient.setQueryData<Milestone[]>(milestonesKeys.list(), (cur) => {
        if (!cur) return [removed];
        if (cur.some((mil) => mil.id === removed.id)) return cur;
        return [...cur, removed];
      });
    },
  });
}

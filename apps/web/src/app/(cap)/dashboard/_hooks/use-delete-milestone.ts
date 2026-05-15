"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeleteMilestoneInput, DeleteMilestoneOutput, Milestone } from "@pekulo/validators";
import { compassKeys, milestonesKeys } from "@/lib/zapaction/keys";
import { deleteMilestone } from "@/lib/actions/milestones-actions";

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation<
    DeleteMilestoneOutput,
    Error,
    DeleteMilestoneInput,
    { previous: Milestone[] | undefined }
  >({
    mutationFn: (input) => deleteMilestone(input),
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
      // blanket overwrite would resurrect the other mutation's deleted row
      // until onSettled invalidate landed.
      const removed = ctx?.previous?.find((mil) => mil.id === input.id);
      if (!removed) return;
      queryClient.setQueryData<Milestone[]>(milestonesKeys.list(), (cur) => {
        if (!cur) return [removed];
        if (cur.some((mil) => mil.id === removed.id)) return cur;
        return [...cur, removed];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: milestonesKeys.list() });
      // Removing the last milestone flips compass.setup back to "incomplete".
      queryClient.invalidateQueries({ queryKey: compassKeys.setup() });
    },
  });
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DeleteMilestoneInput, DeleteMilestoneOutput, Milestone } from "@pekulo/validators";
import { milestonesKeys } from "@/lib/zapaction/keys";
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
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(milestonesKeys.list(), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: milestonesKeys.list() });
    },
  });
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Compass, UpdateCompassInput } from "@pekulo/validators";
import { compassKeys, milestonesKeys } from "@/lib/zapaction/keys";
import { updateCompass } from "../../_actions/compass-actions";

export function useUpdateCompass() {
  const queryClient = useQueryClient();
  return useMutation<Compass, Error, UpdateCompassInput>({
    mutationFn: (input) => updateCompass(input),
    onSuccess: () => {
      // Compass change moves the donut + curve + history + every milestone
      // status (linear-plan target shifted). Invalidate the whole graph.
      queryClient.invalidateQueries({ queryKey: compassKeys.current() });
      queryClient.invalidateQueries({ queryKey: compassKeys.setup() });
      queryClient.invalidateQueries({ queryKey: compassKeys.progress() });
      queryClient.invalidateQueries({ queryKey: compassKeys.curve() });
      queryClient.invalidateQueries({ queryKey: compassKeys.history() });
      queryClient.invalidateQueries({ queryKey: milestonesKeys.list() });
    },
  });
}

"use client";

import { useActionMutation } from "@zapaction/query";
import { updateRental } from "../_actions/realestate-actions";

export function useUpdateRental() {
  return useActionMutation(updateRental);
}

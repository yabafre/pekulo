"use client";

import { useActionMutation } from "@zapaction/query";
import { attachRental } from "../_actions/realestate-actions";

export function useAttachRental() {
  return useActionMutation(attachRental);
}

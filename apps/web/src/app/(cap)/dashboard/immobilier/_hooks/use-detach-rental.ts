"use client";

import { useActionMutation } from "@zapaction/query";
import { detachRental } from "../_actions/realestate-actions";

export function useDetachRental() {
  return useActionMutation(detachRental);
}

"use client";

import { useActionMutation } from "@zapaction/query";
import { updateTransaction } from "../_actions/transactions-actions";

export function useUpdateTransaction() {
  return useActionMutation(updateTransaction);
}

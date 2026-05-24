"use client";

import { useActionMutation } from "@zapaction/query";
import { deleteTransaction } from "../_actions/transactions-actions";

export function useDeleteTransaction() {
  return useActionMutation(deleteTransaction);
}

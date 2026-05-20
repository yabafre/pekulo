"use client";

import { useActionQuery } from "@zapaction/query";
import { accountsKeys } from "@/lib/zapaction/keys";
import { listAccounts } from "../_actions/accounts-actions";

export function useAccounts() {
  return useActionQuery(listAccounts, {
    input: undefined,
    queryKey: accountsKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}

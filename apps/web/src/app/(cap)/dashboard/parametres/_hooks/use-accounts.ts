"use client";

import { useQuery } from "@tanstack/react-query";
import type { Account } from "@pekulo/validators";
import { accountsKeys } from "@/lib/zapaction/keys";
import { listAccounts } from "@/lib/actions/accounts-actions";

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: accountsKeys.list(),
    queryFn: () => listAccounts(),
    staleTime: 30_000,
  });
}

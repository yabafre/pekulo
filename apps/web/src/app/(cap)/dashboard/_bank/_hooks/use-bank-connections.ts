"use client";

import { useActionQuery } from "@zapaction/query";
import { bankConnectionsKeys } from "@/lib/zapaction/keys";
import { listBankConnections } from "../_actions/bank-aggregator-actions";

export function useBankConnections() {
  return useActionQuery(listBankConnections, {
    input: undefined,
    queryKey: bankConnectionsKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}

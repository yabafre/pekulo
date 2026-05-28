"use client";

// Story 5-7 — reconnect (SCA re-auth). No list mutation: on success the
// component redirects the browser to the Bridge connectUrl. invalidateWithTags
// is defensive (the list may rebind after the user returns through the
// callback page).

import { useActionMutation } from "@zapaction/query";
import { bankConnectionsTags } from "@/lib/zapaction/keys";
import { reconnectBankConnection } from "../_actions/bank-aggregator-actions";

export function useReconnectBankConnection() {
  return useActionMutation(reconnectBankConnection, {
    invalidateWithTags: [bankConnectionsTags.list()],
  });
}

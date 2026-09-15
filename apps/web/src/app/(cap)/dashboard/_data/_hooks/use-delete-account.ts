"use client";

// apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts
// Story 11-2 (FR-50). The orchestration boundary ADR-0010 requires: the
// dialog component never reaches the server action directly.
//
// `useDeleteUserAccount`, not `useDeleteAccount`: _accounts/_hooks already owns
// that name for removing a BANK account, and the two must never be confused.
//
// No `invalidateWithTags`: every cached query belongs to an account that no
// longer exists, and the component navigates away from the app on success.
import { useActionMutation } from "@zapaction/query";
import { deleteUserAccount } from "../_actions/data-actions";

export function useDeleteUserAccount() {
  return useActionMutation(deleteUserAccount, {});
}

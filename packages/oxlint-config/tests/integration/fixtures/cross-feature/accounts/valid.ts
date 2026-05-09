import { listAccounts } from "@/features/accounts/server/list";
export function inner() {
  return listAccounts();
}

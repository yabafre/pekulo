import { listHoldings } from "@/features/holdings/server/list";
export function bad() {
  return listHoldings();
}

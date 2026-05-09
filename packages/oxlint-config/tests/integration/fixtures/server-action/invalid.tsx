import { recordTx } from "@/lib/actions/transactions";
export function TxForm() {
  return <button onClick={() => recordTx({})}>Save</button>;
}

import { useTx } from "@/hooks/use-tx";
export function TxList() {
  const tx = useTx();
  return <div>{tx.length}</div>;
}

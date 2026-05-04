// apps/web/src/lib/orpc/types.ts
// Re-export oRPC type helpers so feature stories can `import type { … } from "@/lib/orpc/types"`
// without reaching into @orpc/contract directly.

export type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from "@orpc/contract";

// packages/contracts/src/milestones.contract.ts
// Milestones module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/milestones).

export const milestonesContractV1 = {} as const;
export const milestonesContract = milestonesContractV1;
export const milestonesContractMeta = {
  moduleKey: "milestones",
  mountPath: "/rpc/v1/milestones",
  version: "v1",
} as const;

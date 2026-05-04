// id-prefixes.config.ts — single source of truth for Pekulo prefixed IDs.
//
// Per ADR-0012 the registry is pre-populated for every Pekulo model — including
// future ones not yet declared in the schema folder. This guarantees every Prisma
// `create` either lands in a registered prefix or throws a clear MissingPrefixError,
// preventing prefix drift across stories.
//
// `User` carries no prefix (managed by Supabase Auth, native UUID).

export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  Holding: "hld",
  HoldingLot: "lot",

  // Transactions (story 0-4)
  Transaction: "tx",

  // Monthly + KPI (story 0-4)
  Kpi: "kpi",
  MonthlyTracking: "mtr",

  // Hypothesis (story 0-4)
  Hypothesis: "hyp",

  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",

  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",

  // LLM (story 6-1 — registered upfront)
  LlmCallLog: "llm",
  LlmOptIn: "llmo",
} as const satisfies Record<string, string>;

export type ModelName = keyof typeof ID_PREFIXES;
export type Prefix = (typeof ID_PREFIXES)[ModelName];

export class MissingPrefixError extends Error {
  override readonly name = "MissingPrefixError";
  readonly model: string;
  constructor(model: string) {
    super(
      `[prefixed-ids] no prefix registered for model "${model}" — register it in apps/api/src/database/id-prefixes.config.ts`,
    );
    this.model = model;
  }
}

export function getPrefix(model: string): Prefix {
  if (model in ID_PREFIXES) {
    return ID_PREFIXES[model as ModelName];
  }
  throw new MissingPrefixError(model);
}

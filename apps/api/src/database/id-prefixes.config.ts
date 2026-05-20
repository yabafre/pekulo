// id-prefixes.config.ts — single source of truth for Pekulo prefixed IDs.
//
// Per ADR-0012 the registry is pre-populated for every Pekulo model — including
// future ones not yet declared in the schema folder. This guarantees every Prisma
// `create` either lands in a registered prefix or throws a clear MissingPrefixError,
// preventing prefix drift across stories.
//
// **Brownfield exception (2026-05-10):** models created with native PostgreSQL
// UUID columns BEFORE the prefixed-ids policy landed are registered with
// `null`. The extension skips injection — the underlying column type rejects
// `<prefix>_<base62>` anyway. The schema must supply its own default for the
// create branch (e.g. `@default(dbgenerated("gen_random_uuid()"))`).
//
// `User` carries no prefix (managed by Supabase Auth, native UUID).

export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  AccountBalanceLog: "abl",
  Holding: "hld",
  HoldingLot: "lot",

  // Transactions (story 0-4)
  Transaction: "tx",

  // Monthly + KPI (story 0-4)
  Kpi: "kpi",
  MonthlyTracking: "mtr",

  // Hypothesis (story 0-4) — brownfield UUID column, see header note.
  // Surfaced 2026-05-10 when story 1-4 first exercised
  // `compass.upsertCompassWithHistory` end-to-end against a real Supabase
  // project: PostgreSQL rejected `id = "hyp_<base62>"` against `id uuid`.
  Hypothesis: null,

  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",

  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateMortgage: "resm",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",

  // LLM (story 6-1 — registered upfront)
  LlmCallLog: "llm",
  LlmOptIn: "llmo",
} as const satisfies Record<string, string | null>;

export type ModelName = keyof typeof ID_PREFIXES;
export type Prefix = NonNullable<(typeof ID_PREFIXES)[ModelName]>;

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

/**
 * Resolve the prefix for a model.
 * - Returns the prefix string for registered Pekulo models.
 * - Returns `null` for brownfield models that opt out of injection.
 * - Throws `MissingPrefixError` for models absent from the registry.
 */
export function getPrefix(model: string): Prefix | null {
  if (model in ID_PREFIXES) {
    return ID_PREFIXES[model as ModelName];
  }
  throw new MissingPrefixError(model);
}

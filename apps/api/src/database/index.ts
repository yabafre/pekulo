// database/ — Prisma client + extensions + ID conventions.
// See ADR-0012 (prefixed IDs) + ADR-0014 (Prisma migrate, supersedes ADR-0006).
//
// This barrel is the public surface of the database module. Consumers outside
// `apps/api/src/database/` MUST import through this file, not through the
// sibling implementation files — the indirection lets the module evolve
// (add prisma-error-mapper.ts, factor id-prefixes, etc.) without touching
// every callsite.
//
// Re-exports were trimmed in PR #86 then restored as part of the same
// audit-correction pass — knip flagged the symbols as "barrel-unused"
// because every internal consumer imports them directly, but the barrel is
// the architectural surface (not a knip-decideable concern). Re-deletion
// without an ADR amendment is a review fail.
//
// Story 0-5 will add prisma-error-mapper.ts re-exports here (P2025 → RlsViolationError).

export {
  createPrismaService,
  type PrismaService,
  type ExtendedPrismaClient,
} from "./prisma.service";
export {
  ID_PREFIXES,
  getPrefix,
  MissingPrefixError,
  type ModelName,
  type Prefix,
} from "./id-prefixes.config";
export { generateBase62Id } from "./base62";
export { injectPrefixedId } from "./prefixed-ids.injector";
export { prefixedIdsExtension } from "./prefixed-ids.extension";

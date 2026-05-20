// database/ — Prisma client + extensions + ID conventions.
// See ADR-0012 (prefixed IDs) + ADR-0014 (Prisma migrate, supersedes ADR-0006).
//
// Story 0-5 will add prisma-error-mapper.ts re-exports here (P2025 → RlsViolationError).
// Do NOT pre-bake those exports.

export {
  createPrismaService,
  type PrismaService,
  type ExtendedPrismaClient,
} from "./prisma.service";

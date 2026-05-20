// packages/types/src/index.ts
// Pekulo shared TypeScript types — domain entities consumed across apps/web,
// apps/api (DTOs), and apps/mobile (V1.5). Per ADR-0011 + architecture
// L366–L368 the types live here, NOT inlined in component files.
//
// Conventions:
//   - PascalCase domain types (Account, Holding, MonthlyRecord, …).
//   - SCREAMING_SNAKE_CASE `as const` arrays for closed enumerations
//     (ACCOUNT_TYPES, HOLDING_KINDS, LLM_ROUTES, …) — string-literal
//     unions are derived via `(typeof X)[number]`.
//   - Branded primitives for prefixed IDs via the shared `Id<TBrand>`
//     helper (see `HoldingId` / `HoldingLotId` in `./holding`).
//
// Folder-by-domain layout per architecture.md Phase 3 R7 sibling:
// `<domain>/<domain>.types.ts` + `<domain>/index.ts` — this barrel
// re-exports each domain index.

export * from "./shared";
export * from "./account";
export * from "./holding";
export * from "./transaction";
export * from "./milestone";
export * from "./monthly";
export * from "./realestate";
export * from "./composition";
export * from "./stat";
export * from "./compass";

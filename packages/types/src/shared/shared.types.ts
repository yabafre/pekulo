// packages/types/src/shared/shared.types.ts
// Cross-domain primitive helpers.
//
// Branded ID primitive — placeholder shape until story 0-4 wires the
// full prefix scheme alongside the Prisma id-prefixes registry. UI types
// reference these as opaque strings.

export type Id<TBrand extends string> = string & { __brand: TBrand };

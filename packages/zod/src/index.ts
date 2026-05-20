// packages/zod/src/index.ts
// Single source of Zod for the Pekulo monorepo (ADR-0011, architecture.md
// L859). No file in packages/* or apps/* should `import { z } from "zod"`
// directly — they all go through `@pekulo/zod`.
//
// Why: enforces one zod version across the monorepo, centralizes the future
// Pekulo helper surface (Money, EuroAmount, IsoDate, Percent, tabularNum),
// and gives a single migration hook for future zod major bumps.
//
// Helpers land incrementally in dedicated stories — for now this module
// only re-exports the zod surface.

export * from "zod";
export { z } from "zod";

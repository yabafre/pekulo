// Backward-compat re-export. The Zod source of truth moved to @pekulo/validators
// in story 0-6 to match @pekulo/contracts. Direct imports from this file keep
// working — call sites are migrated lazily.
export { hypothesesSchema, type HypothesesInput } from "@pekulo/validators";

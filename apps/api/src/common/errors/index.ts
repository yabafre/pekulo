// apps/api/src/common/errors/index.ts
// Barrel re-export for common/errors/*. Module factories import from here.

export { PekuloError, isPekuloError } from "./pekulo-error";
export type { PekuloErrorCode } from "./pekulo-error";
export { attachRequestId, extractRequestId } from "./request-id-tag";

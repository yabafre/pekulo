// apps/web/test/vitest-axe.d.ts
// Module augmentation for vitest-axe matchers — TypeScript needs the
// `toHaveNoViolations` chain method declared on Vitest's Assertion type.
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

// apps/web/test/setup.tsx
// Vitest setup hook for apps/web. Installs:
//   - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
//   - vitest-axe matchers (toHaveNoViolations)
// Story 1-4 introduces the first web-side tests; this setup mirrors
// packages/ui/test/setup.tsx so a11y assertions surface identically.

import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);

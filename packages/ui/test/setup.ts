// packages/ui/test/setup.ts
// Vitest setup hook for @pekulo/ui.
// - Installs @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
// - Installs vitest-axe matchers (toHaveNoViolations)
// - Exports renderWithTamagui() — wraps render() with <PekuloRootProvider>
//   so theme tokens resolve in the test DOM.
//
// Note: the import of "../public/tamagui.generated.css" makes the atomic
// class definitions available to happy-dom — without it, computed-style
// assertions (when later added) wouldn't see Pekulo tokens.

import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

expect.extend(matchers);

// Lazy import to avoid loading Tamagui at config-evaluation time.
function PekuloTestProvider({ children }: { children: ReactNode }): ReactElement {
  // Imported inside the component so the module graph in vitest.config.ts
  // doesn't pull Tamagui into setup before happy-dom is ready.
  const { PekuloRootProvider } = require("../src/provider");
  return PekuloRootProvider({ children });
}

export function renderWithTamagui(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: PekuloTestProvider, ...options });
}

// Re-export common testing utilities for convenience.
export { fireEvent, screen, waitFor } from "@testing-library/react";
export { axe } from "vitest-axe";

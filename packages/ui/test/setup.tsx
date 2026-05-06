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
import { TamaguiProvider } from "tamagui";

import { config } from "../src/config/tamagui";

expect.extend(matchers);

// Test wrapper: TamaguiProvider only (no NextThemeProvider — that wrapper
// pulls @tamagui/next-theme which imports next/script, a peer that lives
// only in apps/web). defaultTheme="pekulo-dark" still applies in tests.
function TamaguiTestProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <TamaguiProvider
      config={config}
      defaultTheme="pekulo-dark"
      disableInjectCSS
      disableRootThemeClass
    >
      {children}
    </TamaguiProvider>
  );
}

export function renderWithTamagui(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: TamaguiTestProvider, ...options });
}

// Re-export common testing utilities for convenience.
export { fireEvent, screen, waitFor } from "@testing-library/react";
export { axe } from "vitest-axe";

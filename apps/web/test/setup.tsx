// apps/web/test/setup.tsx
// Vitest setup hook for apps/web. Installs:
//   - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
//   - vitest-axe matchers (toHaveNoViolations)
//   - renderWithTamagui() — wraps render() with TamaguiProvider only.
//     Mirrors packages/ui/test/setup.tsx — bypasses NextThemeProvider so
//     happy-dom doesn't try to load next/script (which crashes in tests).

import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { TamaguiProvider } from "tamagui";

import { config } from "@pekulo/ui/tamagui-config";

expect.extend(matchers);

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

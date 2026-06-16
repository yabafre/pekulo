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
import { ToastProvider } from "@pekulo/ui";

expect.extend(matchers);

// Mirror packages/ui/test/setup.tsx: report `prefers-reduced-motion: reduce` so
// rAF-driven count-ups (e.g. PekuloDonut's fromZero mount sweep) render settled
// instead of mid-animation — deterministic DOM, no unwrapped act() updates.
// Non-motion media queries (Tamagui breakpoints) still report no-match; a test
// can reassign window.matchMedia to exercise the motion-allowed path.
if (typeof window !== "undefined") {
  window.matchMedia = ((query: string) => ({
    matches: /prefers-reduced-motion/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function TamaguiTestProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <TamaguiProvider
      config={config}
      defaultTheme="pekulo-dark"
      disableInjectCSS
      disableRootThemeClass
    >
      {/* `ToastProvider` is mounted by `PekuloRootProvider` in production —
          tests bypass that wrapper for happy-dom compatibility (no
          next/script), so mount the provider explicitly here. Any component
          that consumes `useToast` (e.g. MilestonesSection on delete error)
          would otherwise crash with "useToast must be used inside
          <ToastProvider>". */}
      <ToastProvider>{children}</ToastProvider>
    </TamaguiProvider>
  );
}

export function renderWithTamagui(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: TamaguiTestProvider, ...options });
}

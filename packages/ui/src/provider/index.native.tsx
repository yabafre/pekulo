// packages/ui/src/provider/index.native.tsx
// Native root provider for @pekulo/ui consumers (apps/mobile).
// Mounts TamaguiProvider with Pekulo themes (`pekulo-dark` / `pekulo-light`)
// driven by OS color scheme or an explicit theme override, plus ToastProvider
// and runtime theme switching context (`useThemeSetting`).

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { TamaguiProvider, Theme } from "tamagui";

import { config } from "../config/tamagui";
import { PekuloToastViewport, ToastProvider } from "../toast/index.native";

export interface PekuloRootProviderProps {
  children: ReactNode;
  /** Optional explicit theme override; defaults to OS color scheme ("pekulo-dark" fallback). */
  theme?: "pekulo-dark" | "pekulo-light" | "system";
}

export interface NativeThemeSetting {
  current: "pekulo-dark" | "pekulo-light" | "system";
  resolvedTheme: "pekulo-dark" | "pekulo-light";
  themes: Array<"pekulo-dark" | "pekulo-light">;
  set: (next: "pekulo-dark" | "pekulo-light" | "system") => void;
}

const NativeThemeContext = createContext<NativeThemeSetting>({
  current: "system",
  resolvedTheme: "pekulo-dark",
  themes: ["pekulo-dark", "pekulo-light"],
  set: () => {},
});

export function useThemeSetting(): NativeThemeSetting {
  return useContext(NativeThemeContext);
}

export function PekuloRootProvider({ children, theme = "system" }: PekuloRootProviderProps) {
  const colorScheme = useColorScheme();
  const [override, setOverride] = useState<"pekulo-dark" | "pekulo-light" | "system" | null>(null);
  const [prevThemeProp, setPrevThemeProp] = useState(theme);
  if (theme !== prevThemeProp) {
    setPrevThemeProp(theme);
    setOverride(null);
  }
  const activeChoice = override ?? theme;
  const resolvedTheme: "pekulo-dark" | "pekulo-light" =
    activeChoice === "system"
      ? colorScheme === "light"
        ? "pekulo-light"
        : "pekulo-dark"
      : activeChoice;

  const setting = useMemo<NativeThemeSetting>(
    () => ({
      current: activeChoice,
      resolvedTheme,
      themes: ["pekulo-dark", "pekulo-light"],
      set: setOverride,
    }),
    [activeChoice, resolvedTheme],
  );

  return (
    <NativeThemeContext.Provider value={setting}>
      <TamaguiProvider config={config} defaultTheme={resolvedTheme}>
        <Theme name={resolvedTheme}>
          <ToastProvider>
            {children}
            <PekuloToastViewport />
          </ToastProvider>
        </Theme>
      </TamaguiProvider>
    </NativeThemeContext.Provider>
  );
}

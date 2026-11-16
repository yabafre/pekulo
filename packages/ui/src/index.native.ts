// packages/ui/src/index.native.ts
// React Native public barrel for @pekulo/ui (resolved via package.json
// "react-native" export condition by Metro and apps/mobile tsconfig).
//
// Exposes only native-safe modules and ported pilot components so Metro never
// pulls web-only DOM dependencies (lucide-react, vaul, react-day-picker,
// react-resizable-panels, @tamagui/next-theme) before story 10-3 completes
// the full 41-file native parity pass.

export { PekuloRootProvider, type PekuloRootProviderProps } from "./provider/index.native";

// Pure design tokens and theme maps
export * from "./tokens";
export * from "./themes";

// Native-safe animation hook (guards window.matchMedia)
export { useCountUp, type UseCountUpOptions } from "./animations/use-count-up";

// Cross-platform pilot components (pure Tamagui Text + View)
export { PekuloStat, type PekuloStatProps } from "./components/PekuloStat";
export { PekuloHero, type PekuloHeroProps } from "./components/PekuloHero";

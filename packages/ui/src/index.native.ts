// packages/ui/src/index.native.ts
// React Native public barrel for @pekulo/ui (resolved via package.json
// "react-native" export condition by Metro, Jest, and apps/mobile tsconfig).
// Mirrors 100% of packages/ui/src/index.ts.

// Provider (native TamaguiProvider + Theme + ToastProvider + useThemeSetting)
export * from "./provider/index.native";

// Toast (hook + native absolute-positioned viewport)
export * from "./toast/index.native";

// Pure design tokens and theme maps
export * from "./tokens";
export * from "./themes";

// Animation hooks (window.matchMedia guarded)
export * from "./animations";

// Primitives (Metro / TS moduleSuffixes resolve *.native.tsx automatically)
export * from "./primitives";

// Domain components (Metro / TS moduleSuffixes resolve *.native.tsx automatically)
export * from "./components";

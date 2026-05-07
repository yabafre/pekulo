// packages/ui/src/index.ts
// Public barrel for @pekulo/ui. Consumers import everything from here.
//
// `apps/web` (and `apps/mobile` at V1.5) MUST consume Tamagui through this
// barrel — never `import { ... } from "tamagui"` directly (architecture
// L213: `@pekulo/ui` is the sole DS surface). The re-exports below give
// consumers the low-level Tamagui primitives without leaking the dep.

// Tamagui primitives — re-exported so apps don't need a direct `tamagui`
// dep. Component-level `Pekulo*` exports below should be preferred where
// available; raw primitives are an escape hatch for one-offs (auth form,
// etc.).
export { Text, View, styled } from "tamagui";
export type { TextProps, ViewProps } from "tamagui";

// Provider (single client boundary)
export * from "./provider";

// Tokens (raw data — for build tooling, contrast tests, charts that need
// typed access to colors)
export * from "./tokens";

// Themes (Tamagui theme maps)
export * from "./themes";

// Animation hooks
export * from "./animations";

// Primitives (framework-agnostic — Section, HeaderAction)
export * from "./primitives";

// Domain components (Pekulo* prefixed) land in T5/T6.
// Re-exported from ./components/index.ts as they are added.
export * from "./components";

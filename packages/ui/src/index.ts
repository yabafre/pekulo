// packages/ui/src/index.ts
// Public barrel for @pekulo/ui. Consumers import everything from here.

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

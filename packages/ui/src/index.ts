// packages/ui/src/index.ts
// Public barrel for @pekulo/ui. Consumers import everything from here.
//
// `apps/web` (and `apps/mobile` at V1.5) MUST consume Tamagui through this
// package — never `import { ... } from "tamagui"` directly (architecture
// L213: `@pekulo/ui` is the sole DS surface). Raw Tamagui primitives
// (`Text`, `View`, `styled`) live behind the `@pekulo/ui/client` sub-path
// — they cannot be re-exported from this barrel because Tamagui's module
// evaluation calls `createContext` at load time, which crashes the Next
// RSC server pass (lesson L17). The main barrel here keeps tokens /
// themes / types / Pekulo-prefixed components RSC-safe; sub-modules with
// their own `"use client"` directive handle the client islands.

// Provider (single client boundary)
export * from "./provider";

// Toast (hook + viewport — consumed by ./provider; kept as a sibling so the
// provider doesn't have to import from ./components, avoiding a latent
// provider ↔ components barrel cycle)
export * from "./toast";

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

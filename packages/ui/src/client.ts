"use client";

// packages/ui/src/client.ts
// Client-only barrel — exposes raw Tamagui primitives (`Text`, `View`,
// `styled`) for apps that need an escape hatch beyond the `Pekulo*`
// catalogue. Consumed via `import { ... } from "@pekulo/ui/client"`.
//
// Lives in a separate sub-path because Tamagui's module-evaluation calls
// `createContext` at load time, which crashes Next.js's RSC server pass
// (lesson L17). Importing this barrel from a Server Component crashes the
// build with `createContext is not a function`. The main `@pekulo/ui`
// barrel keeps tokens / themes / types RSC-safe; client-only code goes
// through this sub-path.

export { Text, View, styled } from "tamagui";
export type { TextProps, ViewProps } from "tamagui";

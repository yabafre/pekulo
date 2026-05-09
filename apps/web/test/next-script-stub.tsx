// apps/web/test/next-script-stub.tsx
// happy-dom can't resolve "next/script" (subpath without .js extension); the
// runtime barrel @tamagui/next-theme imports it eagerly. The test env never
// renders the provider that uses it, so a no-op stub keeps the import graph
// resolvable without changing app code.
import type { ComponentProps, ReactElement } from "react";

export default function Script(_props: ComponentProps<"script">): ReactElement | null {
  return null;
}

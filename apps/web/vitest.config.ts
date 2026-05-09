// apps/web/vitest.config.ts
// Vitest configuration for the Next.js web app — story 1-4 introduces the
// first web-side tests (deriveMilestoneCardItems unit + per-component a11y).
// Mirrors packages/ui/vitest.config.ts (happy-dom, vitest-axe matchers via
// setup file). The Next.js app and the test runner share the @ alias.

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.tsx"],
    css: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    server: {
      // Inline tamagui packages so vite resolves their transitive imports
      // (e.g. @tamagui/next-theme → next/script) through our aliases.
      deps: {
        inline: [/@tamagui/, /tamagui/],
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // @tamagui/next-theme imports "next/script" eagerly; happy-dom can't
      // resolve the bare subpath. Tests never render the provider that uses
      // it — the stub keeps the import graph resolvable.
      "next/script": resolve(__dirname, "./test/next-script-stub.tsx"),
      // Next.js "server-only" throws at import time when client-bundled.
      // Tests never split server/client — stub keeps import resolvable.
      "server-only": resolve(__dirname, "./test/server-only-stub.ts"),
      // @zapaction/core's setActionContext throws on client-side import
      // (happy-dom has window). Stub neutralizes the assert + provides a
      // passthrough defineAction so a11y tests can still render hooks.
      "@zapaction/core": resolve(__dirname, "./test/zapaction-core-stub.ts"),
    },
  },
});

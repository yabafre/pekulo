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
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});

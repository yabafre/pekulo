// packages/ui/vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.tsx"],
    css: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Coverage gate (F15) — 70 % lines / functions / statements, 60 %
    // branches on @pekulo/ui. UI library coverage is dominated by
    // snapshot + a11y rendering tests; the floor catches dead code +
    // unimported components without forcing exhaustive branch coverage
    // on responsive variants / reduced-motion / tone branches that are
    // visually obvious.
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__snapshots__/**",
        "src/**/index.ts",
        "src/index.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});

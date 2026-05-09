// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-cross-feature-action-import.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-cross-feature-action-import", rule, {
  valid: [
    {
      code: `import { x } from "@/features/accounts/inner";`,
      filename: "apps/web/src/features/accounts/foo.ts",
    },
    {
      code: `import { x } from "@/lib/utils";`,
      filename: "apps/web/src/features/accounts/foo.ts",
    },
    {
      code: `import { x } from "@/features/holdings/bar";`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `import { x } from "@/features/holdings/bar";`,
      filename: "apps/web/src/features/accounts/foo.ts",
      errors: [{ messageId: "crossFeature", data: { from: "accounts", to: "holdings" } }],
    },
    {
      code: `import { y } from "@/features/milestones/server/list";`,
      filename: "apps/web/src/features/compass/server/projection.ts",
      errors: [{ messageId: "crossFeature", data: { from: "compass", to: "milestones" } }],
    },
    {
      code: `import { z } from "@/features/monthly/hooks/use-tracking";`,
      filename: "apps/web/src/features/transactions/components/list.tsx",
      errors: [{ messageId: "crossFeature", data: { from: "transactions", to: "monthly" } }],
    },
    // Dynamic import — M4 bypass closed.
    {
      code: `const { listHoldings } = await import("@/features/holdings/server/list");`,
      filename: "apps/web/src/features/accounts/foo.ts",
      errors: [{ messageId: "crossFeature", data: { from: "accounts", to: "holdings" } }],
    },
  ],
});

// Type-import behaviour is covered by the integration smoke fixture
// (oxc parser carries `importKind: "type"`); espree does not support
// the TS `import type` syntax so RuleTester cannot exercise that path
// without a TS-aware parser dep. The smoke fixture asserts the
// fail-open default (`allowTypeImports: true`).

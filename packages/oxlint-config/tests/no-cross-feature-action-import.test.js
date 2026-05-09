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
  ],
});

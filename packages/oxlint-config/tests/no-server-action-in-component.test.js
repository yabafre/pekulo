// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-server-action-in-component.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-server-action-in-component", rule, {
  valid: [
    {
      code: `import { recordTx } from "@/lib/actions/transactions";`,
      filename: "apps/web/src/hooks/use-record-tx.ts",
    },
    {
      code: `import { useRecordTx } from "@/hooks/use-record-tx";`,
      filename: "apps/web/src/components/foo.tsx",
    },
    {
      code: `import { format } from "@/lib/utils";`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `import { recordTx } from "@/lib/actions/transactions";`,
      filename: "apps/web/src/components/transactions-form.tsx",
      errors: [{ messageId: "forbidden" }],
    },
    {
      code: `import { listAccounts } from "@/lib/actions/accounts";`,
      filename: "apps/web/src/app/dashboard/page.tsx",
      errors: [{ messageId: "forbidden" }],
    },
    {
      code: `import { signOff } from "../../lib/actions/monthly";`,
      filename: "apps/web/src/components/monthly/sign-off.tsx",
      errors: [{ messageId: "forbidden" }],
    },
    // Dynamic import — the M3 bypass closed.
    {
      code: `const { recordTx } = await import("@/lib/actions/transactions");`,
      filename: "apps/web/src/components/transactions-form.tsx",
      errors: [{ messageId: "forbidden" }],
    },
  ],
});

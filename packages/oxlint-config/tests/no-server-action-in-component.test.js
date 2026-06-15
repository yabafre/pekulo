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
    // Allowlisted per-feature actions — the documented Supabase Auth exception.
    {
      code: `import { signOut } from "@/app/(auth)/_actions/auth-actions";`,
      filename: "apps/web/src/components/auth-form.tsx",
      options: [{ allow: ["(auth)/_actions/"] }],
    },
  ],
  invalid: [
    // Per-feature action imported into a component (not allowlisted) — the M2
    // blind spot, now caught.
    {
      code: `import { updateCompass } from "@/app/(cap)/dashboard/_compass/_actions/compass-actions";`,
      filename: "apps/web/src/app/(cap)/dashboard/_compass/_components/compass-edit-form.tsx",
      errors: [{ messageId: "forbidden" }],
    },
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

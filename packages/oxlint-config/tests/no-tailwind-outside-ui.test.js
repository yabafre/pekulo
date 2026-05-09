// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-tailwind-outside-ui.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-tailwind-outside-ui", rule, {
  valid: [
    {
      code: `const x = <div className="flex p-4" />;`,
      filename: "packages/ui/src/components/foo.tsx",
    },
    {
      code: `const x = <div className="my-component-class" />;`,
      filename: "apps/web/src/components/foo.tsx",
    },
    {
      code: `const x = <div id="root" />;`,
      filename: "apps/web/src/components/foo.tsx",
    },
    // cn() with non-tailwind classes — must not fire.
    {
      code: `const c = cn("my-class", "another-class");`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `const x = <div className="flex p-4" />;`,
      filename: "apps/web/src/components/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    {
      code: `const x = <div className="text-sm font-semibold" />;`,
      filename: "apps/web/src/app/page.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    {
      code: `import "tailwindcss";`,
      filename: "apps/web/src/app/globals.ts",
      errors: [{ messageId: "tailwindImport" }],
    },
    // cn("flex p-4") — the bypass class M2.
    {
      code: `const c = cn("flex p-4");`,
      filename: "apps/web/src/components/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    // clsx({ "flex p-4": true })
    {
      code: `const c = clsx({ "flex p-4": cond });`,
      filename: "apps/web/src/components/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    // Template literal inside JSXExpressionContainer.
    {
      code: "const x = <div className={`flex p-4 ${conditional}`} />;",
      filename: "apps/web/src/components/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    // tailwindcss/utilities sub-path — covered.
    {
      code: `import "tailwindcss/utilities";`,
      filename: "apps/web/src/app/globals.ts",
      errors: [{ messageId: "tailwindImport" }],
    },
    // @tailwindcss/forms — scoped sub-package.
    {
      code: `import "@tailwindcss/forms";`,
      filename: "apps/web/src/app/globals.ts",
      errors: [{ messageId: "tailwindImport" }],
    },
    // uiRoot anchor strict: file under `packages/ui-helpers/` is NOT exempt.
    {
      code: `const x = <div className="flex p-4" />;`,
      filename: "packages/ui-helpers/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
  ],
});

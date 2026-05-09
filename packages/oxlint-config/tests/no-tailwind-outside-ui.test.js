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
  ],
});

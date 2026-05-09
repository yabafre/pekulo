// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-prisma-query-without-user-id.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-prisma-query-without-user-id", rule, {
  valid: [
    `await prisma.account.findMany({ where: { userId: ctx.userId } });`,
    `await prisma.account.create({ data: { userId: ctx.userId } });`,
    {
      code: `await prisma.fxRate.findMany({ where: { ccy: 'EUR' } });`,
      options: [{ unscopedModels: ["fxRate"] }],
    },
    `await db.account.findMany({ where: { foo: 1 } });`,
  ],
  invalid: [
    {
      code: `await prisma.account.findMany();`,
      errors: [{ messageId: "missingUserId", data: { model: "account" } }],
    },
    {
      code: `await prisma.holding.updateMany({ where: { foo: 1 } });`,
      errors: [{ messageId: "missingUserId", data: { model: "holding" } }],
    },
    {
      code: `await prisma.transaction.delete({ where: { id: 'tx_1' } });`,
      errors: [{ messageId: "missingUserId", data: { model: "transaction" } }],
    },
  ],
});

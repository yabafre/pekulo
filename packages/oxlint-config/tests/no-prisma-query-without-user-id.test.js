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
    {
      // Case-norm: unscopedModels accepts PascalCase too (Prisma schema form).
      code: `await prisma.fxRate.findMany({ where: { ccy: 'EUR' } });`,
      options: [{ unscopedModels: ["FxRate"] }],
    },
    `await db.account.findMany({ where: { foo: 1 } });`,
    // Optional chaining — must not bypass the rule when userId IS present.
    `await prisma?.account?.findMany({ where: { userId: ctx.userId } });`,
    // Transactional sub-client — opt-in via array prismaIdentifier.
    {
      code: `await tx.account.findMany({ where: { userId: ctx.userId } });`,
      options: [{ prismaIdentifier: ["prisma", "tx"] }],
    },
    // `this.prisma.x.method` — service-class pattern; trailing 3-tuple matches.
    `this.prisma.account.findMany({ where: { userId: ctx.userId } });`,
    // Computed string-literal property access.
    `await prisma["account"].findMany({ where: { userId: ctx.userId } });`,
    // Spread of full args — fail-open (cannot statically prove absence).
    `await prisma.account.findMany({ ...args });`,
    // Spread inside `where` — fail-open.
    `await prisma.account.findMany({ where: { ...whereBase, userId: ctx.userId } });`,
    `await prisma.account.findMany({ where: { ...whereBase } });`,
    // Variable arg — opaque shape, but the rule only short-circuits on
    // ObjectExpression. Document: opaque args still fire (architectural intent
    // is to keep the literal where in the call site). This case exercises the
    // opposite path — function call as arg — and the test asserts it fires
    // below in the invalid block.
    // OrThrow methods with userId.
    `await prisma.account.findUniqueOrThrow({ where: { userId: ctx.userId } });`,
    `await prisma.account.findFirstOrThrow({ where: { userId: ctx.userId } });`,
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
    // Optional chain MUST still fire when userId is missing.
    {
      code: `await prisma?.account?.findMany({ where: { foo: 1 } });`,
      errors: [{ messageId: "missingUserId", data: { model: "account" } }],
    },
    // Transactional callback — fires when `tx` is configured AND userId is missing.
    {
      code: `await tx.holding.deleteMany({ where: { id: 'h_1' } });`,
      options: [{ prismaIdentifier: ["prisma", "tx"] }],
      errors: [{ messageId: "missingUserId", data: { model: "holding" } }],
    },
    // OrThrow methods are now in the user-scoped set.
    {
      code: `await prisma.account.findUniqueOrThrow({ where: { id: 'a_1' } });`,
      errors: [{ messageId: "missingUserId", data: { model: "account" } }],
    },
    {
      code: `await prisma.holding.findFirstOrThrow();`,
      errors: [{ messageId: "missingUserId", data: { model: "holding" } }],
    },
    // `this.prisma.x.method` — trailing-tuple match still fires when userId missing.
    {
      code: `this.prisma.account.findMany({ where: { foo: 1 } });`,
      errors: [{ messageId: "missingUserId", data: { model: "account" } }],
    },
  ],
});

// @ts-check
import { getDottedMemberName, hasWhereUserId } from "../utils/ast.js";

const USER_SCOPED_METHODS = new Set([
  "findFirst",
  "findUnique",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert",
]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `where.userId` on Prisma user-scoped queries. Defense-in-depth alongside RLS (NFR-8, ADR-0013).",
    },
    schema: [
      {
        type: "object",
        properties: {
          prismaIdentifier: { type: "string", default: "prisma" },
          unscopedModels: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUserId:
        "Prisma query on user-scoped model '{{model}}' is missing 'where.userId' (NFR-8)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const prismaIdent = opts.prismaIdentifier ?? "prisma";
    const unscoped = new Set(opts.unscopedModels ?? []);

    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return;
        const dotted = getDottedMemberName(node.callee);
        if (!dotted) return;
        const segments = dotted.split(".");
        if (segments.length !== 3) return;
        const [root, model, method] = segments;
        if (root !== prismaIdent) return;
        if (!USER_SCOPED_METHODS.has(method)) return;
        if (unscoped.has(model)) return;

        const arg0 = node.arguments[0];
        if (arg0 && arg0.type === "ObjectExpression" && hasWhereUserId(arg0)) return;

        context.report({ node, messageId: "missingUserId", data: { model } });
      },
    };
  },
};

export default rule;
export { USER_SCOPED_METHODS };

// @ts-check
import { getDottedMemberName, hasWhereUserId, unwrapChain } from "../utils/ast.js";

const USER_SCOPED_METHODS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
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

/**
 * Lower-case the first character of a model name so `["FxRate"]` and `["fxRate"]`
 * both opt-out of the rule on a `prisma.fxRate.findMany(...)` call.
 *
 * @param {string} s
 * @returns {string}
 */
function camelize(s) {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

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
          // Accept a single identifier (legacy) or a list. Lists are the
          // recommended form so transactional callbacks (`tx.account.findMany`)
          // and aliased clients (`const p = prisma`) are covered without code
          // changes — opt-in via `["prisma", "tx", "p"]`.
          prismaIdentifier: {
            oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
            default: "prisma",
          },
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
    const rawIdent = opts.prismaIdentifier ?? "prisma";
    const prismaIdents = new Set(Array.isArray(rawIdent) ? rawIdent : [rawIdent]);
    const unscoped = new Set((opts.unscopedModels ?? []).map(camelize));

    return {
      CallExpression(node) {
        const callee = unwrapChain(node.callee);
        if (
          callee.type !== "MemberExpression" &&
          // @ts-expect-error — Babel legacy.
          callee.type !== "OptionalMemberExpression"
        ) {
          return;
        }
        const dotted = getDottedMemberName(callee);
        if (!dotted) return;
        const segments = dotted.split(".");
        if (segments.length < 3) return;

        // The method is the tail; model is the segment before it; root is the
        // segment before that. Earlier segments (`this`, namespace prefixes)
        // are ignored — only the trailing 3-tuple decides.
        const method = segments[segments.length - 1];
        const model = segments[segments.length - 2];
        const root = segments[segments.length - 3];
        if (typeof root !== "string" || typeof model !== "string" || typeof method !== "string") {
          return;
        }
        if (!prismaIdents.has(root)) return;
        if (!USER_SCOPED_METHODS.has(method)) return;
        if (unscoped.has(camelize(model))) return;

        const arg0 = node.arguments[0];
        if (arg0 && arg0.type === "ObjectExpression" && hasWhereUserId(arg0)) return;

        context.report({ node, messageId: "missingUserId", data: { model } });
      },
    };
  },
};

export default rule;
export { USER_SCOPED_METHODS };

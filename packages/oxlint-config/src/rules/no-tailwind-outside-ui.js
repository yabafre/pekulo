// @ts-check
import { fileUnderDir, getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

// Heuristic detector. Covers the prefixed utilities (`p-4`, `text-sm`, ...) and
// a small set of bareword utilities (`flex`, `grid`, ...). Known limitations:
// arbitrary values (`[mask:…]`), modifiers (`hover:`, `dark:`, `md:`), and
// gradient stops (`from-`, `to-`, `via-`) are NOT in the alternation — false
// negatives are tolerated, the rule is one half of FR-55 (the other half is
// the absence of `tailwindcss` import + the convention that `@pekulo/ui` is
// the only styling surface). False positives on user-defined classnames that
// happen to share a prefix with a TW utility (e.g. `text-content`) are the
// reciprocal cost — see README "known limitations" for the trade-off.
const TW_TOKEN_RE =
  /\b(?:p|m|w|h|min|max|flex|grid|bg|text|font|rounded|shadow|gap|border|space|leading|tracking|opacity|z|inset|top|right|bottom|left)-[a-z0-9.\-/]+|\b(?:flex|grid|hidden|block|inline|inline-block|relative|absolute|fixed|sticky|static)\b/;

const DEFAULT_CLASSNAME_HELPERS = ["clsx", "cn", "tw", "twMerge", "classNames"];

/**
 * Scan a string for Tailwind tokens and report on `node` when found.
 *
 * @param {import("eslint").Rule.RuleContext} context
 * @param {import("estree").Node} node
 * @param {string} value
 */
function reportIfTailwind(context, node, value) {
  if (TW_TOKEN_RE.test(value)) {
    context.report({ node, messageId: "tailwindClass" });
  }
}

/**
 * Walk a node looking for embedded string literals (Literal, TemplateLiteral
 * with no expressions, both branches of LogicalExpression / ConditionalExpression,
 * keys/values of an ObjectExpression). Reports each one through `reportIfTailwind`.
 *
 * @param {import("eslint").Rule.RuleContext} context
 * @param {import("estree").Node} node
 */
function walkForTailwindLiterals(context, node) {
  if (!node) return;
  /** @type {any} */
  const n = node;
  if (n.type === "Literal") {
    if (typeof n.value === "string") reportIfTailwind(context, n, n.value);
    return;
  }
  if (n.type === "TemplateLiteral") {
    // Only the static quasis are checkable. Each cooked chunk is concatenated
    // and matched as a unit so a token spanning two static parts is still seen.
    const cooked = n.quasis.map((/** @type {any} */ q) => q.value.cooked ?? "").join(" ");
    reportIfTailwind(context, n, cooked);
    return;
  }
  if (n.type === "LogicalExpression") {
    walkForTailwindLiterals(context, n.left);
    walkForTailwindLiterals(context, n.right);
    return;
  }
  if (n.type === "ConditionalExpression") {
    walkForTailwindLiterals(context, n.consequent);
    walkForTailwindLiterals(context, n.alternate);
    return;
  }
  if (n.type === "ArrayExpression") {
    for (const el of n.elements) walkForTailwindLiterals(context, el);
    return;
  }
  if (n.type === "ObjectExpression") {
    // clsx({ "flex p-4": true }) — keys carry the tokens.
    for (const prop of n.properties) {
      if (prop.type === "Property" && !prop.computed) {
        if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
          reportIfTailwind(context, prop.key, prop.key.value);
        }
      }
    }
    return;
  }
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Tailwind utility classes and `tailwindcss` imports outside `packages/ui/`. Enforces FR-55.",
    },
    schema: [
      {
        type: "object",
        properties: {
          uiRoot: { type: "string", default: "packages/ui/" },
          classnameHelpers: {
            type: "array",
            items: { type: "string" },
            default: DEFAULT_CLASSNAME_HELPERS,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tailwindClass: "Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)",
      tailwindImport: "Direct `tailwindcss` import is forbidden outside @pekulo/ui (FR-55)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const uiRoot = (opts.uiRoot ?? "packages/ui/").endsWith("/")
      ? (opts.uiRoot ?? "packages/ui/")
      : (opts.uiRoot ?? "packages/ui/") + "/";
    const helpers = new Set(opts.classnameHelpers ?? DEFAULT_CLASSNAME_HELPERS);
    const filename = normaliseFilename(
      context.filename ?? context.getFilename?.() ?? "",
      context.cwd,
    );
    if (fileUnderDir(filename, uiRoot)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (
          src === "tailwindcss" ||
          src === "tailwindcss/preflight" ||
          src === "tailwindcss/utilities" ||
          src === "tailwindcss/components" ||
          (typeof src === "string" && src.startsWith("@tailwindcss/"))
        ) {
          context.report({ node: node.source, messageId: "tailwindImport" });
        }
      },
      /** @param {any} node */
      JSXAttribute(node) {
        if (!node.name || node.name.type !== "JSXIdentifier") return;
        if (node.name.name !== "className" && node.name.name !== "class") return;
        if (!node.value) return;
        // className="literal"
        if (node.value.type === "Literal") {
          if (typeof node.value.value === "string") {
            reportIfTailwind(context, node.value, node.value.value);
          }
          return;
        }
        // className={…} — descend into the expression.
        if (node.value.type === "JSXExpressionContainer") {
          walkForTailwindLiterals(context, node.value.expression);
        }
      },
      CallExpression(node) {
        // cn(...), clsx(...), tw(...) — scan each argument as a className expression.
        if (node.callee.type !== "Identifier") return;
        if (!helpers.has(node.callee.name)) return;
        for (const arg of node.arguments) {
          walkForTailwindLiterals(context, arg);
        }
      },
    };
  },
};

export default rule;

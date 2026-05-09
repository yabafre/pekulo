// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

const TW_TOKEN_RE =
  /\b(?:p|m|w|h|min|max|flex|grid|bg|text|font|rounded|shadow|gap|border|space|leading|tracking|opacity|z|inset|top|right|bottom|left)-[a-z0-9.\-/]+|\b(?:flex|grid|hidden|block|inline|inline-block|relative|absolute|fixed|sticky|static)\b/;

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
    const uiRoot = opts.uiRoot ?? "packages/ui/";
    const filename = normaliseFilename(
      context.filename ?? context.getFilename?.() ?? "",
      context.cwd,
    );
    if (filename.startsWith(uiRoot) || filename.includes("/" + uiRoot)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (src === "tailwindcss" || src === "tailwindcss/preflight") {
          context.report({ node: node.source, messageId: "tailwindImport" });
        }
      },
      /** @param {any} node */
      JSXAttribute(node) {
        if (!node.name || node.name.type !== "JSXIdentifier") return;
        if (node.name.name !== "className") return;
        if (!node.value) return;
        if (node.value.type !== "Literal") return;
        const v = node.value.value;
        if (typeof v !== "string") return;
        if (TW_TOKEN_RE.test(v)) {
          context.report({ node: node.value, messageId: "tailwindClass" });
        }
      },
    };
  },
};

export default rule;

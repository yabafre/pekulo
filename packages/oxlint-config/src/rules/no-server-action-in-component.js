// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

/**
 * Detect whether an import source resolves under the configured action root.
 * Handles the `@/` alias and bare relative imports.
 *
 * @param {string} source
 * @param {string} actionRoot - e.g. "apps/web/src/lib/actions/"
 * @returns {boolean}
 */
function importTargetsActions(source, actionRoot) {
  if (source.startsWith("@/lib/actions/") || source === "@/lib/actions") return true;
  const idx = actionRoot.indexOf("src/");
  if (idx >= 0) {
    const aliased = "@/" + actionRoot.slice(idx + 4);
    if (source === aliased || source.startsWith(aliased)) return true;
  }
  return source.includes("/lib/actions/") || source.endsWith("/lib/actions");
}

/**
 * Detect whether a file lives under one of the configured component roots.
 *
 * @param {string} filename
 * @param {string[]} roots
 * @returns {boolean}
 */
function isComponentFile(filename, roots) {
  return roots.some((r) => filename.startsWith(r) || filename.includes("/" + r));
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid components from importing server actions directly. Enforces hard layering Component → Hook → Action (arch L168).",
    },
    schema: [
      {
        type: "object",
        properties: {
          actionRoot: { type: "string", default: "apps/web/src/lib/actions/" },
          componentRoots: {
            type: "array",
            items: { type: "string" },
            default: ["apps/web/src/components/", "apps/web/src/app/"],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        "Server action imported directly into a component — go through a custom hook (arch L168)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const actionRoot = opts.actionRoot ?? "apps/web/src/lib/actions/";
    const componentRoots = opts.componentRoots ?? ["apps/web/src/components/", "apps/web/src/app/"];
    const filename = normaliseFilename(
      context.filename ?? context.getFilename?.() ?? "",
      context.cwd,
    );
    if (!isComponentFile(filename, componentRoots)) return {};

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (!src) return;
        if (importTargetsActions(src, actionRoot)) {
          context.report({ node: node.source, messageId: "forbidden" });
        }
      },
    };
  },
};

export default rule;

// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

/**
 * Resolve the feature name a file lives in, given a list of feature roots.
 * Returns the feature segment, or null if outside any feature root.
 *
 * @param {string} filename
 * @param {string[]} featureRoots
 * @returns {{ root: string; feature: string } | null}
 */
function resolveFeature(filename, featureRoots) {
  for (const root of featureRoots) {
    const idx = filename.indexOf(root);
    if (idx === -1) continue;
    const tail = filename.slice(idx + root.length);
    const seg = tail.split("/")[0];
    if (!seg) continue;
    return { root, feature: seg };
  }
  return null;
}

/**
 * Resolve the feature name an aliased import targets.
 *
 * @param {string} source
 * @param {string[]} featureRoots
 * @returns {string | null}
 */
function resolveImportFeature(source, featureRoots) {
  if (source.startsWith("@/features/")) {
    return source.slice("@/features/".length).split("/")[0] || null;
  }
  for (const root of featureRoots) {
    const idx = source.indexOf(root);
    if (idx !== -1) {
      const tail = source.slice(idx + root.length);
      return tail.split("/")[0] || null;
    }
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid imports between sibling features. Enforces feature-boundary import discipline (arch L505).",
    },
    schema: [
      {
        type: "object",
        properties: {
          featureRoots: {
            type: "array",
            items: { type: "string" },
            default: ["apps/web/src/features/"],
          },
          // When true (default), `import type { ... }` between sibling
          // features is allowed — type imports erase at compile time and
          // expressing a contract via shared types is a deliberate idiom.
          // Set to false to enforce the boundary on types as well.
          allowTypeImports: { type: "boolean", default: true },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      crossFeature:
        "Cross-feature import — feature '{{from}}' must not depend on feature '{{to}}' (arch L505)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const featureRoots = opts.featureRoots ?? ["apps/web/src/features/"];
    const allowTypeImports = opts.allowTypeImports ?? true;
    const filename = normaliseFilename(
      context.filename ?? context.getFilename?.() ?? "",
      context.cwd,
    );
    const here = resolveFeature(filename, featureRoots);
    if (!here) return {};
    const hereFeature = here.feature;

    /**
     * @param {import("estree").Node} sourceNode
     * @param {import("estree").Node} reportNode
     */
    function checkSource(sourceNode, reportNode) {
      const src = getStringLiteralValue(sourceNode);
      if (!src) return;
      const target = resolveImportFeature(src, featureRoots);
      if (!target) return;
      if (target === hereFeature) return;
      context.report({
        node: reportNode,
        messageId: "crossFeature",
        data: { from: hereFeature, to: target },
      });
    }

    return {
      /** @param {any} node */
      ImportDeclaration(node) {
        // `import type { Foo } from "@/features/holdings/types"` — the AST
        // carries `importKind: "type"` (oxc + @typescript-eslint/parser).
        // Plain ESLint/espree omits the field; the comparison reads as
        // false and the rule fires as before.
        if (allowTypeImports && node.importKind === "type") return;
        checkSource(node.source, node.source);
      },
      // `await import("@/features/...")` — same source-target check.
      /** @param {any} node */
      ImportExpression(node) {
        checkSource(node.source, node.source ?? node);
      },
    };
  },
};

export default rule;

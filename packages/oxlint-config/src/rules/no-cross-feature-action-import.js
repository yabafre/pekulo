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
    const filename = normaliseFilename(
      context.filename ?? context.getFilename?.() ?? "",
      context.cwd,
    );
    const here = resolveFeature(filename, featureRoots);
    if (!here) return {};

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (!src) return;
        const target = resolveImportFeature(src, featureRoots);
        if (!target) return;
        if (target === here.feature) return;
        context.report({
          node: node.source,
          messageId: "crossFeature",
          data: { from: here.feature, to: target },
        });
      },
    };
  },
};

export default rule;

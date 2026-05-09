// @ts-check
import noPrismaQueryWithoutUserId from "./rules/no-prisma-query-without-user-id.js";
import noTailwindOutsideUi from "./rules/no-tailwind-outside-ui.js";
import noServerActionInComponent from "./rules/no-server-action-in-component.js";
import noCrossFeatureActionImport from "./rules/no-cross-feature-action-import.js";

/**
 * @pekulo/oxlint-config — Pekulo's custom oxlint plugin.
 *
 * Loaded via `jsPlugins` in `.oxlintrc.json`. Activate rules with the
 * `pekulo/<rule-name>` prefix (matches `meta.name` below).
 *
 * @type {{ meta: { name: string }, rules: Record<string, import("eslint").Rule.RuleModule> }}
 */
const plugin = {
  meta: { name: "pekulo" },
  rules: {
    "no-prisma-query-without-user-id": noPrismaQueryWithoutUserId,
    "no-tailwind-outside-ui": noTailwindOutsideUi,
    "no-server-action-in-component": noServerActionInComponent,
    "no-cross-feature-action-import": noCrossFeatureActionImport,
  },
};

export default plugin;

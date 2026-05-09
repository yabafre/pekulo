// @ts-check
/**
 * Shared AST helpers for @pekulo/oxlint-config rules.
 * Pure functions — no rule-specific state.
 */

/**
 * Unwrap a `ChainExpression` to its inner expression. ESTree wraps optional
 * chains in `ChainExpression > MemberExpression(optional:true)`; callers that
 * walk a chain need the inner node, not the wrapper.
 *
 * @param {import("estree").Node} node
 * @returns {import("estree").Node}
 */
export function unwrapChain(node) {
  if (node && node.type === "ChainExpression") return node.expression;
  return node;
}

/**
 * Resolve a chain of `MemberExpression`s to a dotted string.
 * Returns null if any segment is non-resolvable (computed with non-string-literal,
 * non-Identifier root other than `this`).
 *
 * Handles:
 * - plain `MemberExpression` (`prisma.account.findMany`)
 * - optional `MemberExpression` with `optional:true` and `ChainExpression` wrappers
 * - legacy Babel `OptionalMemberExpression`
 * - computed access with string literals (`prisma["account"].findMany`)
 * - `ThisExpression` root (mapped to the literal segment `"this"`)
 *
 * @param {import("estree").Node} node
 * @returns {string | null}
 */
export function getDottedMemberName(node) {
  /** @type {string[]} */
  const parts = [];
  /** @type {import("estree").Node} */
  let current = unwrapChain(node);
  while (
    current &&
    (current.type === "MemberExpression" ||
      // @ts-expect-error — Babel-parser legacy node type.
      current.type === "OptionalMemberExpression")
  ) {
    /** @type {import("estree").MemberExpression} */
    const me = /** @type {any} */ (current);
    if (me.computed) {
      if (me.property.type !== "Literal") return null;
      if (typeof me.property.value !== "string") return null;
      parts.unshift(me.property.value);
    } else {
      if (me.property.type !== "Identifier") return null;
      parts.unshift(me.property.name);
    }
    current = me.object;
  }
  if (!current) return null;
  if (current.type === "Identifier") {
    parts.unshift(current.name);
    return parts.join(".");
  }
  if (current.type === "ThisExpression") {
    parts.unshift("this");
    return parts.join(".");
  }
  return null;
}

/**
 * Find a direct property of an ObjectExpression by name.
 *
 * @param {import("estree").ObjectExpression} obj
 * @param {string} name
 * @returns {import("estree").Property | null}
 */
export function findObjectProperty(obj, name) {
  if (!obj || obj.type !== "ObjectExpression") return null;
  for (const prop of obj.properties) {
    if (prop.type !== "Property") continue;
    if (prop.computed) continue;
    const k = prop.key;
    if (k.type === "Identifier" && k.name === name) return prop;
    if (k.type === "Literal" && k.value === name) return prop;
  }
  return null;
}

/**
 * Returns true when the ObjectExpression contains at least one `SpreadElement`.
 * Callers use this to fail-open on shapes the rule cannot statically prove
 * (`prisma.account.findMany({ ...args })` may carry `where.userId` via spread).
 *
 * @param {import("estree").ObjectExpression} obj
 * @returns {boolean}
 */
export function hasSpreadElement(obj) {
  if (!obj || obj.type !== "ObjectExpression") return false;
  for (const prop of obj.properties) {
    if (prop.type === "SpreadElement") return true;
  }
  return false;
}

/**
 * Returns true when `obj.where` is an ObjectExpression that directly contains
 * a `userId` property (literal, shorthand, or via SpreadElement).
 *
 * Fail-open behaviour:
 * - When `obj` carries a SpreadElement at the top level, return true (the
 *   spread may inject `where.userId` — RLS catches it at runtime regardless).
 * - When `obj.where` is an ObjectExpression with a SpreadElement, return true.
 * - When `obj.where` resolves to a non-ObjectExpression (variable / call), the
 *   shape is unknown — return true.
 *
 * @param {import("estree").ObjectExpression} obj
 * @returns {boolean}
 */
export function hasWhereUserId(obj) {
  if (hasSpreadElement(obj)) return true;
  const whereProp = findObjectProperty(obj, "where");
  if (!whereProp) return false;
  if (whereProp.value.type !== "ObjectExpression") return true;
  if (hasSpreadElement(whereProp.value)) return true;
  return findObjectProperty(whereProp.value, "userId") !== null;
}

/**
 * Get the string value of an `import "..."` source node.
 *
 * @param {import("estree").Literal | import("estree").Node} node
 * @returns {string | null}
 */
export function getStringLiteralValue(node) {
  if (!node) return null;
  if (node.type === "Literal") {
    return typeof node.value === "string" ? node.value : null;
  }
  if (node.type === "TemplateLiteral") {
    /** @type {import("estree").TemplateLiteral} */
    const tl = /** @type {any} */ (node);
    if (tl.expressions.length === 0) {
      return tl.quasis.map((q) => q.value.cooked ?? "").join("");
    }
  }
  return null;
}

/**
 * Normalise filename to forward slashes; strip `cwd` prefix when supplied.
 *
 * @param {string} filename
 * @param {string} [cwd]
 * @returns {string}
 */
export function normaliseFilename(filename, cwd) {
  let f = filename.replace(/\\/g, "/");
  if (cwd) {
    const c = cwd.replace(/\\/g, "/");
    if (f.startsWith(c + "/")) f = f.slice(c.length + 1);
  }
  return f;
}

/**
 * Returns true when `filename` is anchored under `dir` (a path ending with `/`).
 * Anchored means: file equals dir-without-trailing-slash, OR starts with dir, OR
 * contains the boundary `/dir`. The boundary check rejects accidental matches
 * like `lib/packages/ui-helpers/x.ts` when `dir = "packages/ui/"`.
 *
 * @param {string} filename
 * @param {string} dir - must end with `/`
 * @returns {boolean}
 */
export function fileUnderDir(filename, dir) {
  if (!dir.endsWith("/")) return false;
  if (filename.startsWith(dir)) return true;
  return filename.includes("/" + dir);
}

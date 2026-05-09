// @ts-check
/**
 * Shared AST helpers for @pekulo/oxlint-config rules.
 * Pure functions — no rule-specific state.
 */

/**
 * Resolve a chain of MemberExpression `Identifier`s to a dotted string.
 * Returns null if any segment is computed or non-Identifier.
 *
 * Example: `prisma.account.findMany` → `"prisma.account.findMany"`.
 *
 * @param {import("estree").Node} node
 * @returns {string | null}
 */
export function getDottedMemberName(node) {
  /** @type {string[]} */
  const parts = [];
  /** @type {import("estree").Node} */
  let current = node;
  while (current && current.type === "MemberExpression") {
    if (current.computed) return null;
    if (current.property.type !== "Identifier") return null;
    parts.unshift(current.property.name);
    current = current.object;
  }
  if (!current || current.type !== "Identifier") return null;
  parts.unshift(current.name);
  return parts.join(".");
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
 * Returns true when `obj.where` is an ObjectExpression that directly contains
 * a `userId` property (literal or shorthand).
 *
 * @param {import("estree").ObjectExpression} obj
 * @returns {boolean}
 */
export function hasWhereUserId(obj) {
  const whereProp = findObjectProperty(obj, "where");
  if (!whereProp) return false;
  if (whereProp.value.type !== "ObjectExpression") return false;
  return findObjectProperty(whereProp.value, "userId") !== null;
}

/**
 * Get the string value of an `import "..."` source node.
 *
 * @param {import("estree").Literal | import("estree").Node} node
 * @returns {string | null}
 */
export function getStringLiteralValue(node) {
  if (!node || node.type !== "Literal") return null;
  return typeof node.value === "string" ? node.value : null;
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

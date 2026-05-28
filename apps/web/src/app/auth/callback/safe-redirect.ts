// apps/web/src/app/auth/callback/safe-redirect.ts
// Open-redirect guard (CWE-601) for the Supabase auth callback. The `next`
// query param is attacker-controllable and gets concatenated onto the origin
// (`${origin}${next}`); only a same-origin, path-absolute value is honoured.
// Everything else falls back to the dashboard. Pure (no Next imports) so it
// unit-tests in isolation — same pattern as classify-callback.ts.

const FALLBACK = "/dashboard";

// C0 control chars (0x00–0x1f) + DEL (0x7f). A CR/LF here could split the
// redirect or smuggle a header. Checked by code point to avoid embedding raw
// control bytes in a regex literal.
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function sanitizeNext(next: string | null | undefined): string {
  if (!next) return FALLBACK;
  // Must be a path-absolute URL: exactly one leading slash.
  if (next[0] !== "/") return FALLBACK;
  // Reject scheme-relative ("//host") — the browser resolves it to an
  // external origin even with `origin` prefixed.
  if (next[1] === "/") return FALLBACK;
  // Reject backslash variants ("/\\host", "path\\x") — browsers normalise
  // "\" to "/", so they escape the origin just like "//".
  if (next.includes("\\")) return FALLBACK;
  if (hasControlChar(next)) return FALLBACK;
  return next;
}

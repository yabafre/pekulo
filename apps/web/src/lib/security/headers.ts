// apps/web/src/lib/security/headers.ts
// Edge security headers + CSP for apps/web, applied in proxy.ts on every
// response. Pure (no Next imports) so it unit-tests in isolation.
//
// The CSP is ENFORCED with a per-request nonce on script-src (story 11-7): an
// injected inline <script> without the nonce neither executes nor reads the
// (now httpOnly) session, closing the XSS→session-theft chain. style-src keeps
// 'unsafe-inline' because Tamagui injects <style> dynamically and cannot carry
// a nonce — style injection is not script execution. apps/api is intentionally
// absent from connect-src: the browser only talks to Supabase (auth); oRPC runs
// server-only.

export interface SecurityHeaderOptions {
  /** NODE_ENV === "development" — loosens CSP for dev tooling (react-grab via unpkg, HMR websockets, React's eval-based dev overlay). */
  dev: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL — the browser Supabase client calls it directly for auth/session refresh. */
  supabaseUrl?: string;
  /** Per-request nonce (base64) from proxy.ts. Added to script-src so 'unsafe-inline' can be dropped. */
  nonce: string;
}

export const CSP_ENFORCED_HEADER = "Content-Security-Policy";

export function buildContentSecurityPolicy(opts: SecurityHeaderOptions): string {
  const supabase = opts.supabaseUrl?.trim() ? [opts.supabaseUrl.trim()] : [];
  // 'unsafe-eval' is dev-only — React reconstructs server-side error stacks via
  // eval in the dev overlay (Next's CSP guide mandates it); production needs none
  // of these.
  // react-grab's dev inspector loads its PINNED global build from unpkg — a CDN
  // IIFE that runs OUTSIDE Turbopack (aped-debug 2026-06-03: the bundled import
  // routed react-grab + its source-maps through the dev server and pegged it to
  // ~7 cores on heavy routes) — and pings react-grab.com for its version; Next's
  // dev overlay needs eval + HMR websockets. All DEV ONLY.
  const scriptExtra = opts.dev
    ? ["https://unpkg.com", "https://www.react-grab.com", "'unsafe-eval'"]
    : [];
  const connectExtra = opts.dev ? ["ws:", "https://www.react-grab.com"] : [];
  // react-grab's overlay loads Geist from Google Fonts (stylesheet on googleapis,
  // woff2 on gstatic). DEV ONLY — production self-hosts its fonts.
  const styleExtra = opts.dev ? ["https://fonts.googleapis.com"] : [];
  const fontExtra = opts.dev ? ["https://fonts.gstatic.com"] : [];

  // PROD: nonce-strict, no 'unsafe-inline' — an injected inline <script> without
  // the per-request nonce is blocked (story 11-7, AC-3/AC-4). DEV: the nonce is
  // dropped in favour of 'unsafe-inline' so the dev tooling (react-grab's inline
  // bootstrap, Next's dev overlay) runs without per-script nonces — which also
  // removes the benign server/client nonce hydration mismatch. proxy.ts omits
  // x-nonce in dev to match (the layout's inline theme script then carries none).
  const scriptSrc = opts.dev
    ? ["'self'", "'unsafe-inline'", ...scriptExtra]
    : ["'self'", `'nonce-${opts.nonce}'`];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    // style-src keeps 'unsafe-inline' — Tamagui injects <style> dynamically and
    // cannot carry a nonce; style injection is not script execution (AC-3 scope).
    "style-src": ["'self'", "'unsafe-inline'", ...styleExtra],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", ...fontExtra],
    "connect-src": ["'self'", ...supabase, ...connectExtra],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

export function buildSecurityHeaders(opts: SecurityHeaderOptions): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    // Flipped from Report-Only (#102 groundwork) to ENFORCED now the per-request
    // nonce makes it safe (story 11-7, AC-3).
    [CSP_ENFORCED_HEADER]: buildContentSecurityPolicy(opts),
  };
}

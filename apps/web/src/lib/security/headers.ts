// apps/web/src/lib/security/headers.ts
// Edge security headers + CSP for apps/web, applied in proxy.ts on every
// response. Pure (no Next imports) so it unit-tests in isolation.
//
// CSP ships in Report-Only first (CSP_REPORT_ONLY_HEADER): Tamagui's inline
// styles and the inline theme script in layout.tsx need 'unsafe-inline'; a
// nonce-based ENFORCED CSP is the tracked follow-up (flip after a dev smoke
// test confirms no violation breaks the UI). apps/api is intentionally absent
// from connect-src — the browser never calls it directly (oRPC runs in the
// server tier, server-only). The browser only talks to Supabase (auth).

export interface SecurityHeaderOptions {
  /** NODE_ENV === "development" — loosens CSP for dev tooling (react-grab via unpkg, HMR websockets). */
  dev: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL — the browser Supabase client calls it directly for auth. */
  supabaseUrl?: string;
}

export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

export function buildContentSecurityPolicy(opts: SecurityHeaderOptions): string {
  const supabase = opts.supabaseUrl?.trim() ? [opts.supabaseUrl.trim()] : [];
  const scriptExtra = opts.dev ? ["https://unpkg.com"] : [];
  const connectExtra = opts.dev ? ["ws:", "https://unpkg.com"] : [];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...scriptExtra],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
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
    [CSP_REPORT_ONLY_HEADER]: buildContentSecurityPolicy(opts),
  };
}

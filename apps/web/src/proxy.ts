import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  CSP_ENFORCED_HEADER,
} from "@/lib/security/headers";

export async function proxy(request: NextRequest) {
  // One nonce per request. Next extracts it from the CSP header on the REQUEST
  // during SSR and auto-applies it to its framework/bundled scripts, so the
  // enforced CSP must travel on both the request (for the render) and the
  // response (for the browser).
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspOptions = {
    dev: isDev,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nonce,
  };
  const securityHeaders = buildSecurityHeaders(cspOptions);
  // Derive the CSP from the same options rather than re-indexing the record:
  // under `noUncheckedIndexedAccess` the lookup widens to `string | undefined`,
  // and `headers.set` requires a definite string.
  const csp = buildContentSecurityPolicy(cspOptions);

  // request.headers is immutable — clone it and thread the nonce + CSP into the
  // RSC render. Rebuilt on each NextResponse.next so Supabase's refreshed auth
  // cookies (set on `request` in setAll) ride along with the nonce headers.
  const forwardedHeaders = (): Headers => {
    const headers = new Headers(request.headers);
    // DEV: the CSP is nonce-free ('unsafe-inline'), so omit x-nonce — threading
    // it would only reintroduce the benign server/client nonce hydration
    // mismatch (the layout reads x-nonce for its inline theme script). PROD:
    // thread it so Next + the layout's script carry the per-request nonce.
    if (!isDev) headers.set("x-nonce", nonce);
    headers.set(CSP_ENFORCED_HEADER, csp);
    return headers;
  };

  // Apply edge security headers to EVERY exit path (pass-through + both
  // redirects) so no response escapes unhardened.
  const withSecurity = (res: NextResponse): NextResponse => {
    for (const [name, value] of Object.entries(securityHeaders)) {
      res.headers.set(name, value);
    }
    return res;
  };

  let response = NextResponse.next({ request: { headers: forwardedHeaders() } });

  // Story 6-10 (FR-65) — the logo proxy (/v1/logos?ref=) is PUBLIC reference
  // data (opaque ref, no PII), served by the route handler that forwards to
  // apps/api. Skip the per-request Supabase getUser() here: a transactions page
  // fires 20+ logo requests, and gating each on an auth round-trip would be
  // both slow and pointless (the ref is an opaque cache index, not user data).
  // EXACT path match (not startsWith) so the bypass can never widen to a future
  // `/v1/logos*` sibling route (aped-review 6-10).
  if (request.nextUrl.pathname === "/v1/logos") {
    return withSecurity(response);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Match server.ts — a token refresh here must not downgrade the session
      // cookie back to JS-readable (story 11-7, AC-1).
      cookieOptions: { httpOnly: true },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: forwardedHeaders() } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  // Public (auth) route-group paths — reachable without a session. The route
  // group `(auth)` is invisible in the URL, so these are bare top-level paths
  // (story 8-1 migrated `auth/` → `(auth)/`).
  const PUBLIC_AUTH_PATHS = new Set([
    "/login",
    "/signup",
    "/recover",
    "/callback",
    "/auth-code-error",
  ]);
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.has(pathname);
  const isApi = pathname.startsWith("/api");
  const isStatic = pathname.startsWith("/_next") || pathname.includes(".");

  if (!isStatic) {
    if (!user && !isPublicAuthPath && !isApi && pathname !== "/") {
      return withSecurity(NextResponse.redirect(new URL("/login", request.url)));
    }
    // Bounce signed-in users off login/signup ONLY. NOT `/recover` — a
    // password-recovery session legitimately lands there to set a new
    // password (AC-6). NOT `/callback` — it must run its code exchange first.
    if (user && (pathname === "/login" || pathname === "/signup")) {
      return withSecurity(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
  }

  return withSecurity(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

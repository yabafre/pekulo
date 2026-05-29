# Story: 11-7-auth-hardening-httponly-csp — Server-side login (httpOnly session cookies) + enforced nonce-based CSP

**Epic:** Epic 11 — Public-ramp readiness
**Status:** review
**Source:** ticket
**Ticket ID:** #104
**Ticket URL:** https://github.com/yabafre/pekulo/issues/104
**Origin:** aped-from-ticket
**Branch:** feature/104-11-7-auth-hardening-httponly-csp

## Origin

**#104 — Auth hardening: httpOnly session cookies (server-side login) + nonce-based CSP.**
Surfaced by the 2026-05-28 security stress-test. Two coupled weaknesses leave an **XSS → session-theft** chain open:

1. The session cookie is **JS-readable (not httpOnly)** — login runs client-side: `auth-form.tsx` (`"use client"`) calls `supabase.auth.signInWithPassword` on the **browser** client (`createBrowserClient`), which stores the session via `document.cookie`. Any XSS can read it and exfiltrate the session.
2. The **CSP is Report-Only + `script-src 'unsafe-inline'`** (shipped in #102) — an injected inline `<script>` still executes, so flipping to enforce **as-is** does not close the chain.

At V1 (a) personal-use the risk is bounded (1 user), but this is **load-bearing before the (b) public ramp** (real users = real session-theft targets).

Source: https://github.com/yabafre/pekulo/issues/104

## User Story

**As a** Pekulo user, **I want** my session established server-side as an httpOnly cookie and the app served under an enforced nonce-based CSP, **so that** an injected script can neither execute nor read my session — closing the XSS→session-theft chain before the public ramp.

## Acceptance Criteria

- **AC-1 (httpOnly session cookie)** — **Given** a successful login via the server-action path, **When** I inspect the cookies in the browser, **Then** the Supabase session cookie carries `HttpOnly` and is **not readable** via `document.cookie`. The browser no longer establishes the session via `createBrowserClient.signInWithPassword`.
- **AC-2 (UX parity + sanitised errors)** — **Given** sign-in and sign-up, **When** I submit (valid and invalid credentials), **Then** both work end-to-end via the server-action path, error messages stay **sanitised** (French copy, no raw Supabase strings — "Email ou mot de passe incorrect" for bad creds, a generic line otherwise), and a successful sign-in redirects to `/dashboard`.
- **AC-3 (enforced nonce-based CSP)** — **Given** any page response, **When** I read the headers, **Then** `Content-Security-Policy` is served **enforcing** (not `-Report-Only`), `script-src` is `'self' 'nonce-<per-request>'` with **no `'unsafe-inline'`**, and the app renders with **zero CSP violations** (the inline theme script carries the nonce; Tamagui styles load via `style-src 'unsafe-inline'`).
- **AC-4 (injected inline script blocked)** — **Given** an injected inline `<script>` without the per-request nonce, **When** the page loads, **Then** the browser **blocks** it (manual DevTools check) and the unit suite asserts `script-src` carries no `'unsafe-inline'`.

## Tasks

- [x] **T1 — Server-action login/signup → httpOnly cookies** [AC: AC-1, AC-2]
  Create `apps/web/src/app/auth/_actions/auth-actions.ts` (`"use server"`). Auth talks to Supabase **directly** — it does **NOT** go through the zapaction/oRPC bridge (that bridge is for `apps/api` domain calls). Mirror the precedent in `apps/web/src/app/auth/callback/route.ts`, which already uses the server client (`createClient()` from `@/lib/supabase/server`) + `exchangeCodeForSession`. The server client writes cookies via `next/headers` `cookies()`, which Supabase marks `HttpOnly` — the swallow in `server.ts setAll` only triggers in RSC render; **a Server Action can write cookies**.

  Skeleton (verify the exact Supabase server-auth + Next redirect API first — see Dev Notes § VERIFY-FIRST):
  ```ts
  // apps/web/src/app/auth/_actions/auth-actions.ts
  "use server";

  import { createClient } from "@/lib/supabase/server";

  export type AuthResult = { ok: true } | { ok: false; message: string };

  // Same sanitisation contract as the old client handler — never echo raw
  // Supabase strings (they leak rate-limit hints / server details).
  function friendlySignInError(message: string): string {
    return message === "Invalid login credentials"
      ? "Email ou mot de passe incorrect"
      : "Connexion impossible. Réessaie plus tard.";
  }

  export async function signIn(email: string, password: string): Promise<AuthResult> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: friendlySignInError(error.message) };
    return { ok: true };
  }

  export async function signUp(email: string, password: string): Promise<AuthResult> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email, password });
    // Keep signup error generic (don't reveal whether the email exists).
    if (error) return { ok: false, message: "Inscription refusée. Réessaie." };
    return { ok: true };
  }
  ```
  Then rewire `apps/web/src/components/auth-form.tsx`:
  - Remove the `import { createClient } from "@/lib/supabase/client"` and the `const supabase = createClient()` line.
  - In `handleSubmit`, replace the two `supabase.auth.*` branches with `await signIn(email, password)` / `await signUp(email, password)`.
  - Keep the toasts verbatim (success "Compte créé" / "Vérifie tes emails…"; danger with the returned `message`), keep `router.push("/dashboard"); router.refresh();` on sign-in success.
  Run: `bun --filter=@pekulo/web run typecheck` (or the workspace's tsc task) — Expected: exit 0.
  Commit: `git commit -m "feat(#104): server-action login/signup → httpOnly cookies (AC-1, AC-2)"`

- [x] **T2 — Generate a per-request nonce in `proxy.ts` and thread it to the layout** [AC: AC-3]
  In `apps/web/src/proxy.ts`, generate a nonce **once per request**, forward it to the RSC tree via the `x-nonce` request header, and feed it to `buildSecurityHeaders` so the enforced CSP carries `'nonce-<nonce>'`. Shape (verify the request-header forwarding API against the modified Next — Dev Notes § VERIFY-FIRST):
  ```ts
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // forward the nonce into the RSC render so layout.tsx can read it via headers()
  request.headers.set("x-nonce", nonce);

  const securityHeaders = buildSecurityHeaders({
    dev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    nonce,
  });
  ```
  Keep the existing `withSecurity(...)` wrapper applying the headers to **every** exit path (pass-through + both redirects) — that contract from #102 must not regress.
  Run: `bun --filter=@pekulo/web run typecheck` — Expected: exit 0.
  Commit: `git commit -m "feat(#104): per-request CSP nonce in proxy + x-nonce propagation (AC-3)"`

- [x] **T3 — `headers.ts`: add `nonce`, drop script `'unsafe-inline'`, flip Report-Only → enforced** [AC: AC-3, AC-4]
  Edit `apps/web/src/lib/security/headers.ts`:
  ```ts
  export interface SecurityHeaderOptions {
    /** NODE_ENV === "development" — loosens CSP for dev tooling (react-grab via unpkg, HMR websockets). */
    dev: boolean;
    /** NEXT_PUBLIC_SUPABASE_URL — the browser Supabase client calls it directly for auth/session refresh. */
    supabaseUrl?: string;
    /** Per-request nonce (base64) from proxy.ts. Added to script-src so 'unsafe-inline' can be dropped. */
    nonce: string;
  }

  export const CSP_ENFORCED_HEADER = "Content-Security-Policy";

  export function buildContentSecurityPolicy(opts: SecurityHeaderOptions): string {
    const supabase = opts.supabaseUrl?.trim() ? [opts.supabaseUrl.trim()] : [];
    const scriptExtra = opts.dev ? ["https://unpkg.com"] : [];
    const connectExtra = opts.dev ? ["ws:", "https://unpkg.com"] : [];

    const directives: Record<string, string[]> = {
      "default-src": ["'self'"],
      // nonce replaces 'unsafe-inline' on scripts: an injected inline <script>
      // without the per-request nonce is blocked (story 11-7, AC-3/AC-4).
      "script-src": ["'self'", `'nonce-${opts.nonce}'`, ...scriptExtra],
      // style-src keeps 'unsafe-inline' — Tamagui injects <style> dynamically and
      // cannot carry a nonce; style injection is not script execution (AC-3 scope).
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
      // Flipped from Report-Only (#102 groundwork) to ENFORCED now the nonce
      // makes it safe (story 11-7, AC-3).
      [CSP_ENFORCED_HEADER]: buildContentSecurityPolicy(opts),
    };
  }
  ```
  Remove the now-unused `CSP_REPORT_ONLY_HEADER` export and update the leading file comment to describe the enforced-nonce posture (the current comment says "ships in Report-Only first" — that is no longer true). `grep -rn CSP_REPORT_ONLY_HEADER apps/web/src` to catch any other importer before deleting the export.
  Run: `bun --filter=@pekulo/web run typecheck` — Expected: exit 0.
  Commit: `git commit -m "feat(#104): nonce CSP, drop script unsafe-inline, enforce (AC-3, AC-4)"`

- [x] **T4 — `layout.tsx`: put the nonce on the inline theme script** [AC: AC-3]
  Edit `apps/web/src/app/layout.tsx` — make `RootLayout` `async`, read the nonce, set it on the inline theme `<script>`:
  ```tsx
  import { headers } from "next/headers";
  // ...
  export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const nonce = (await headers()).get("x-nonce") ?? undefined;
    return (
      <html lang="fr" suppressHydrationWarning>
        <head>
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: `/* unchanged theme bootstrap */` }}
          />
          {/* dev-only react-grab Script is an EXTERNAL src (unpkg) — covered by
              script-src https://unpkg.com in dev, no nonce needed. */}
        </head>
        {/* ... */}
      </html>
    );
  }
  ```
  Confirm Next propagates the nonce to its own framework/bundled scripts when the CSP is present on the **request** headers (vanilla Next does this automatically; verify for this build — Dev Notes § VERIFY-FIRST). If it does not, those bundled scripts would be CSP-blocked and the app would not boot — this is the highest-risk integration point.
  Run: `bun --filter=@pekulo/web run typecheck` — Expected: exit 0.
  Commit: `git commit -m "feat(#104): nonce on inline theme script in layout (AC-3)"`

- [x] **T5 — Update `headers.test.ts` (invert Report-Only cases) + add nonce assertions** [AC: AC-3, AC-4]
  Edit `apps/web/src/lib/security/headers.test.ts`. The two existing assertions are now inverted (enforced, not Report-Only); add the nonce + style-src cases. All `buildSecurityHeaders`/`buildContentSecurityPolicy` calls now require a `nonce`:
  ```ts
  import { describe, expect, test } from "vitest";
  import { buildContentSecurityPolicy, buildSecurityHeaders, CSP_ENFORCED_HEADER } from "./headers";

  const NONCE = "dGVzdC1ub25jZQ=="; // fixed base64 test nonce

  describe("buildSecurityHeaders", () => {
    test("emits the zero-risk hardening headers", () => {
      const h = buildSecurityHeaders({ dev: false, nonce: NONCE });
      expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
      expect(h["Strict-Transport-Security"]).toContain("preload");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["X-Content-Type-Options"]).toBe("nosniff");
      expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["Permissions-Policy"]).toContain("geolocation=()");
    });

    test("CSP is ENFORCED, not Report-Only (story 11-7, AC-3)", () => {
      const h = buildSecurityHeaders({ dev: false, nonce: NONCE });
      expect(h[CSP_ENFORCED_HEADER]).toBeDefined();
      expect(h["Content-Security-Policy-Report-Only"]).toBeUndefined();
    });
  });

  describe("buildContentSecurityPolicy", () => {
    test("locks framing, base-uri, form-action and objects", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    test("allows the Supabase origin in connect-src when provided", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE, supabaseUrl: "https://abc.supabase.co" });
      expect(csp).toMatch(/connect-src[^;]*https:\/\/abc\.supabase\.co/);
    });

    test("unpkg + ws: are dev-only", () => {
      const dev = buildContentSecurityPolicy({ dev: true, nonce: NONCE });
      expect(dev).toContain("https://unpkg.com");
      expect(dev).toContain("ws:");
      const prod = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(prod).not.toContain("unpkg.com");
      expect(prod).not.toContain("ws:");
    });

    test("script-src uses the per-request nonce and NOT unsafe-inline (AC-3/AC-4)", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toMatch(new RegExp(`script-src[^;]*'nonce-${NONCE}'`));
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    });

    test("style-src keeps unsafe-inline for Tamagui (AC-3 scope)", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
    });
  });
  ```
  Run: `bun --filter=@pekulo/web test src/lib/security/headers.test.ts`
  Expected: all pass, `0 fail`, exit 0.
  Commit: `git commit -m "test(#104): CSP enforced + nonce + style-src assertions (AC-3, AC-4)"`

- [x] **T6 — Manual browser verification (frontend = visual verification)** [AC: AC-1, AC-4]
  Per CLAUDE.md ("Frontend = visual verification", react-grab at every GREEN):
  1. Run the web app, go to `/auth/login`, sign in with a valid account.
  2. DevTools → Application → Cookies: the Supabase session cookie (`sb-*`) shows **HttpOnly ✓**; in the Console, `document.cookie` does **not** contain it. (AC-1)
  3. DevTools → Console: confirm **zero CSP violations** on `/dashboard` after login (theme script + Tamagui styles render). (AC-3)
  4. Inject an inline `<script>alert(1)</script>` (e.g. via a temporary element or the console-blocked path) and confirm the browser reports a **CSP violation** and does not execute it. (AC-4)
  5. Capture the logged-in dashboard via `mcp__react-grab-mcp__get_element_context` at GREEN.
  No commit (verification only) — record the outcome in the Dev Agent Record.

## Dev Notes

- **⚠️ VERIFY-FIRST (load-bearing — do this before writing T1/T2/T4 code):**
  - **Modified Next.js.** `apps/web/AGENTS.md` mandates reading `node_modules/next/dist/docs/` before writing any code — APIs/conventions differ from training data. Two things to confirm there: (a) how a proxy/middleware forwards a **request header** (`x-nonce`) into the RSC render (vanilla Next uses `NextResponse.next({ request: { headers } })`; the current `proxy.ts` uses `NextResponse.next({ request })`); (b) whether Next **auto-applies the nonce to its own bundled scripts** when the CSP is on the request headers. If (b) is not automatic in this build, T4 must also nonce or otherwise allow the framework scripts, or the app will not boot under enforced CSP.
  - **`@supabase/ssr@^0.10.2`.** Verify the server-action sign-in/sign-up pattern against the **installed** version's docs (Context7 / `npm view @supabase/ssr`) before implementing — per the project's "verify-via-context7" lesson. Confirm that `signInWithPassword` via the server client persists the session as **HttpOnly** cookies, and decide redirect strategy (server-side `redirect("/dashboard")` from `next/navigation` vs returning `{ ok: true }` and letting the client `router.push`). The skeleton uses the latter to keep toasts client-side.
- **Architecture:** ADR-0010 (Component → Hook → Server Action boundary) applies, **but auth bypasses oRPC/zapaction** — it speaks to Supabase directly (precedent: `auth/callback/route.ts`). #102 shipped the CSP Report-Only groundwork in `headers.ts`/`proxy.ts`; this story flips it to enforced. Relevant requirements: FR-46 (login with SSR cookie session), NFR-9 (reject requests lacking a valid session cookie). `docs/security.md` "Web perimeter" section says "CSP enforce flip is a tracked follow-up" — this story IS that follow-up; update that line on completion.
- **Scope guardrail:** the nonce covers **`script-src` only** — `style-src` keeps `'unsafe-inline'` (Tamagui injects `<style>` dynamically; that is style, not script execution). This matches AC-3's literal wording. Out of scope (separate pre-(b) items): rate-limiting, RGPD (#48/#49), MFA.
- **Files:**
  - `apps/web/src/app/auth/_actions/auth-actions.ts` (NEW) — `"use server"` sign-in/sign-up via the Supabase **server** client; sanitised error envelope.
  - `apps/web/src/components/auth-form.tsx` (MODIFY) — call the server action instead of the browser client; keep toasts + redirect.
  - `apps/web/src/proxy.ts` (MODIFY) — per-request nonce, `x-nonce` propagation, feed `buildSecurityHeaders`.
  - `apps/web/src/lib/security/headers.ts` (MODIFY) — `nonce` option, drop script `'unsafe-inline'`, flip to enforced `Content-Security-Policy`.
  - `apps/web/src/app/layout.tsx` (MODIFY) — async layout, nonce on the inline theme script.
  - `apps/web/src/lib/security/headers.test.ts` (MODIFY) — invert Report-Only cases, add nonce/style-src assertions.
  - `apps/web/src/lib/supabase/client.ts` — **keep** (still used for client-side session reads / `getUser`); only the login/signup **write** path moves server-side.
- **Testing:** `bun --filter=@pekulo/web test` (vitest, workspace `@pekulo/web` — use the workspace name, not the folder). `headers.test.ts` covers AC-3/AC-4 mechanically; AC-1/AC-4 browser behaviour is the manual T6 pass.
- **Dependencies:** none new. `@supabase/ssr@^0.10.2`, `@supabase/supabase-js@^2.104.1` already installed. Nonce uses the Web Crypto / `crypto.randomUUID()` already available in the proxy runtime.

### Existing code at write time (Step-0 quotes)

`apps/web/src/components/auth-form.tsx` (current login path — T1 replaces the `supabase.auth.*` calls; the sanitisation block is preserved verbatim in the server action):
```ts
const supabase = createClient(); // browser client — to be removed
// ...
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  const friendly = error.message === "Invalid login credentials"
    ? "Email ou mot de passe incorrect"
    : "Connexion impossible. Réessaie plus tard.";
  toast.danger("Connexion refusée", friendly);
} else { router.push("/dashboard"); router.refresh(); return; }
```

`apps/web/src/lib/supabase/server.ts` (the server client T1 reuses — its `setAll` swallow is RSC-only; a Server Action CAN write the httpOnly cookies):
```ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, { cookies: {
    getAll() { return cookieStore.getAll(); },
    setAll(toSet) { try { toSet.forEach(({name,value,options}) => cookieStore.set(name,value,options)); } catch { /* ignored in RSC */ } },
  }});
}
```

`apps/web/src/app/auth/callback/route.ts` (precedent: server client writing session cookies outside the browser — T1 follows this shape):
```ts
const supabase = await createClient();
const { error } = await supabase.auth.exchangeCodeForSession(code);
```

`apps/web/src/proxy.ts` (current header wiring — T2 adds the nonce; `withSecurity` on every exit path must be kept):
```ts
const securityHeaders = buildSecurityHeaders({
  dev: process.env.NODE_ENV === "development",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
}); // ← add nonce here
let response = NextResponse.next({ request }); // ← request-header forwarding to verify
```

`apps/web/src/lib/security/headers.ts` (current — Report-Only + script `'unsafe-inline'`, both flipped by T3):
```ts
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
// ...
"script-src": ["'self'", "'unsafe-inline'", ...scriptExtra],
// ...
[CSP_REPORT_ONLY_HEADER]: buildContentSecurityPolicy(opts),
```

`apps/web/src/app/layout.tsx` (current inline theme script — T4 adds `nonce={nonce}` and makes the layout async):
```tsx
export default function RootLayout({ children }) {
  return (<html lang="fr" suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: `try { ...theme bootstrap... } catch (e) {}` }} />
    {process.env.NODE_ENV === "development" && (
      <Script src="//unpkg.com/react-grab/dist/index.global.js" crossOrigin="anonymous" strategy="beforeInteractive" />
    )}
  </head><body><Providers>{children}</Providers></body></html>);
}
```

`apps/web/src/lib/security/headers.test.ts` (current assertions T5 inverts):
```ts
test("CSP ships Report-Only first — never enforced yet", () => {
  const h = buildSecurityHeaders({ dev: false });
  expect(h[CSP_REPORT_ONLY_HEADER]).toBeDefined();
  expect(h["Content-Security-Policy"]).toBeUndefined();
});
```

### Risk / overlap flags

- **Overlaps `8-1-supabase-auth-flows` (#42, `pending`).** Both touch the login path: 8-1 reaffirms the broader brownfield lifecycle (signup, login, logout, password-reset) + adds rate-limit; **11-7 hardens the login mechanism** (server-action httpOnly cookies). They are not duplicates, but they must not regress each other. **Recommendation:** when 8-1 is drafted via `aped-story`, scope it to **build on** 11-7's server-action login path (do not reintroduce the browser-client `signInWithPassword`). Not edited here — flag only.
- **No blocking `depends_on`.** The #102 CSP groundwork is merged to `main`; `auth-form`/`proxy`/`headers`/`layout` are all shipped. `depends_on: []`.

## Dev Agent Record

- **Model:** claude-opus-4-8[1m]
- **Started:** 2026-05-29T10:34:37Z
- **Completed:** 2026-05-29T11:04:11Z

### Summary

Closed the XSS→session-theft chain: login/signup moved to a `"use server"`
action writing the session as an **httpOnly** cookie, and the CSP flipped from
Report-Only to **enforced** with a per-request nonce on `script-src` (no
`'unsafe-inline'`). Scope held to the web tier plus one sanctioned `@pekulo/ui`
change. One surprise drove two deviations (below): `@supabase/ssr@0.10.2`
defaults cookies to `httpOnly:false`, and Tamagui's `NextThemeProvider` emitted
a second un-nonced inline script the enforced CSP blocked.

### Files changed

- `apps/web/src/app/auth/_actions/auth-actions.ts` (NEW) — `"use server"` sign-in/sign-up via the Supabase server client; sanitised error envelope.
- `apps/web/src/app/auth/_actions/auth-actions.test.ts` (NEW) — AC-2 sanitisation contract.
- `apps/web/src/components/auth-form.tsx` — calls the server action instead of the browser client; toasts + redirect kept.
- `apps/web/src/lib/supabase/server.ts` — `cookieOptions: { httpOnly: true }` (AC-1 fix).
- `apps/web/src/lib/supabase/server.test.ts` (NEW) — AC-1 httpOnly-wiring regression guard.
- `apps/web/src/proxy.ts` — per-request nonce; nonce + CSP forwarded on the request headers; `httpOnly` on the refresh path; `withSecurity` on every exit kept.
- `apps/web/src/lib/security/headers.ts` — `nonce` option, drop script `'unsafe-inline'`, enforced `Content-Security-Policy`, dev-only `'unsafe-eval'`; removed `CSP_REPORT_ONLY_HEADER`.
- `apps/web/src/lib/security/headers.test.ts` — inverted to enforced + nonce + style-src + dev `'unsafe-eval'`.
- `apps/web/src/app/layout.tsx` — async; nonce on the inline theme script.
- `packages/ui/src/provider/index.tsx` — dropped `skipNextHead` so the anti-FOUC theme script routes through `next/script` and receives the nonce (T6-surfaced AC-3 fix; user-approved scope extension).

### Deviations

- **AC-1 mechanism corrected (user-approved).** The story assumed the server client marks cookies `HttpOnly` automatically; `@supabase/ssr@0.10.2` `DEFAULT_COOKIE_OPTIONS` is `httpOnly:false` (verified in source). Added `cookieOptions: { httpOnly: true }` on **both** `server.ts` (login write) and `proxy.ts` (refresh) so the flag holds durably.
- **CSP on the request headers (verified-from-docs).** Next extracts the nonce from the CSP header on the *request* to auto-nonce its framework/bundled scripts, so the enforced CSP is set on both request and response; `request.headers` is immutable so it is cloned (the skeleton's `request.headers.set` would throw).
- **Dev `'unsafe-eval'` added** to `script-src` (dev-only) — Next's CSP guide mandates it for React's dev overlay; T6 runs the dev server.
- **`@pekulo/ui` touched (user-approved, outside the declared file list).** Tamagui's `NextThemeProvider` (`skipNextHead`) emitted a second bare inline `<script>` the enforced CSP blocked → AC-3 console violation. Dropping `skipNextHead` routes it through `next/script`, which Next nonces. Verified live: 0 un-nonced inline scripts remain.
- **Commit grouping:** T2+T3+T5 landed in one commit — the now-required `nonce` field couples `headers.ts`↔`proxy.ts`, so neither typechecks alone.
- **Test command:** used `bun --filter=@pekulo/web run test …`; the story's `bun … test` (no `run`) triggers Bun's native runner, not vitest.
- **No `'strict-dynamic'`** (per story) — correct here: react-grab loads from unpkg by host, which `strict-dynamic` would block.

### Test output

`bun --filter=@pekulo/web run test` → **Test Files 64 passed (64) · Tests 134 passed (134) · exit 0**.
`bun --filter=@pekulo/ui run test` → 119 files · 193 passed | 1 skipped · exit 0 (DS unaffected by the provider change).
Typecheck (`tsc --noEmit`) web + ui → exit 0.

AC→test trace: AC-1 → `server.test.ts` (httpOnly wiring, witnessed RED on flag flip); AC-2 → `auth-actions.test.ts` (5 tests); AC-3 → `headers.test.ts` (enforced + nonce + style-src) + live header check; AC-4 → `headers.test.ts` (`script-src` no `'unsafe-inline'`) + live HTML check.

### Live verification (automated, dev server :3002)

- **AC-3 ✓** — `/auth/login` serves `Content-Security-Policy` (enforced, not Report-Only); `script-src 'self' 'nonce-…'` with no `'unsafe-inline'`; `style-src` keeps `'unsafe-inline'`; Supabase in `connect-src`.
- **Boot risk cleared ✓** — every inline script (mine + Tamagui's + Next's framework) carries the per-request nonce; **0 un-nonced inline scripts** → no inline-script CSP violation; theme bootstrap (`data-theme` + `classList`) still served.

### Manual checks remaining for the user (no browser/credentials in this session)

1. **AC-1 (live):** log in, DevTools → Application → Cookies — the `sb-*` cookie shows **HttpOnly ✓**; Console `document.cookie` does **not** contain it.
2. **AC-4 (live):** inject `<script>alert(1)</script>` via DevTools — the browser reports a CSP violation and does not execute it.
   (react-grab MCP was unavailable this session, so the visual capture is deferred to review — Aria/`aped-review` will catch it.)

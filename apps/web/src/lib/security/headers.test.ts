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

  // AC-3 (verbatim from story 11-7-auth-hardening-httponly-csp:31):
  //   Content-Security-Policy is served enforcing (not -Report-Only) ...
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
    const csp = buildContentSecurityPolicy({
      dev: false,
      nonce: NONCE,
      supabaseUrl: "https://abc.supabase.co",
    });
    expect(csp).toMatch(/connect-src[^;]*https:\/\/abc\.supabase\.co/);
  });

  test("unpkg + ws: + unsafe-eval are dev-only", () => {
    const dev = buildContentSecurityPolicy({ dev: true, nonce: NONCE });
    expect(dev).toContain("https://unpkg.com");
    expect(dev).toContain("ws:");
    // React's dev overlay needs eval; Next's CSP guide mandates it in dev only.
    expect(dev).toContain("'unsafe-eval'");

    const prod = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
    expect(prod).not.toContain("unpkg.com");
    expect(prod).not.toContain("ws:");
    expect(prod).not.toContain("'unsafe-eval'");
  });

  test("Google Fonts (react-grab dev overlay) is dev-only", () => {
    const dev = buildContentSecurityPolicy({ dev: true, nonce: NONCE });
    expect(dev).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    expect(dev).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);

    const prod = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
    expect(prod).not.toContain("fonts.googleapis.com");
    expect(prod).not.toContain("fonts.gstatic.com");
  });

  test("dev script-src drops the nonce for 'unsafe-inline' + react-grab; prod stays nonce-strict", () => {
    const dev = buildContentSecurityPolicy({ dev: true, nonce: NONCE });
    expect(dev).toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(dev).toContain("https://www.react-grab.com");
    expect(dev).not.toContain(`'nonce-${NONCE}'`); // no per-script nonce in dev

    const prod = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
    expect(prod).toMatch(new RegExp(`script-src[^;]*'nonce-${NONCE}'`));
    expect(prod).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(prod).not.toContain("react-grab.com");
  });

  // AC-3/AC-4 (verbatim from story 11-7-auth-hardening-httponly-csp:31-32):
  //   script-src is 'self' 'nonce-<per-request>' with no 'unsafe-inline' ...
  //   the unit suite asserts script-src carries no 'unsafe-inline'.
  test("script-src uses the per-request nonce and NOT unsafe-inline (AC-3/AC-4)", () => {
    const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
    expect(csp).toMatch(new RegExp(`script-src[^;]*'nonce-${NONCE}'`));
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  // AC-3: "Tamagui styles load via style-src 'unsafe-inline'" — the nonce
  // scope is script-src only.
  test("style-src keeps unsafe-inline for Tamagui (AC-3 scope)", () => {
    const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
  });
});

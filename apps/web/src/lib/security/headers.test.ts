import { describe, expect, test } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  CSP_REPORT_ONLY_HEADER,
} from "./headers";

describe("buildSecurityHeaders", () => {
  test("emits the zero-risk hardening headers", () => {
    const h = buildSecurityHeaders({ dev: false });
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(h["Strict-Transport-Security"]).toContain("preload");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
  });

  test("CSP ships Report-Only first — never enforced yet", () => {
    const h = buildSecurityHeaders({ dev: false });
    expect(h[CSP_REPORT_ONLY_HEADER]).toBeDefined();
    expect(h["Content-Security-Policy"]).toBeUndefined();
  });
});

describe("buildContentSecurityPolicy", () => {
  test("locks framing, base-uri, form-action and objects", () => {
    const csp = buildContentSecurityPolicy({ dev: false });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  test("allows the Supabase origin in connect-src when provided", () => {
    const csp = buildContentSecurityPolicy({
      dev: false,
      supabaseUrl: "https://abc.supabase.co",
    });
    expect(csp).toMatch(/connect-src[^;]*https:\/\/abc\.supabase\.co/);
  });

  test("unpkg + ws: are dev-only", () => {
    const dev = buildContentSecurityPolicy({ dev: true });
    expect(dev).toContain("https://unpkg.com");
    expect(dev).toContain("ws:");

    const prod = buildContentSecurityPolicy({ dev: false });
    expect(prod).not.toContain("unpkg.com");
    expect(prod).not.toContain("ws:");
  });
});

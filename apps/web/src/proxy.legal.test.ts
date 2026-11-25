import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

import { proxy } from "./proxy";

// AC-1 (verbatim from story 10-7-store-compliance-and-agent-testers:27):
//   Given an unauthenticated or authenticated visitor, When they request
//   `/privacy`, `/terms`, `/support`, or `/account-deletion` on the web app,
//   Then the edge proxy serves the exact path with HTTP 200 and full
//   security/CSP headers without calling Supabase authentication or redirecting
//   to `/login` (while non-exact sibling paths remain protected)
describe("proxy public legal routes (story 10-7, AC-1)", () => {
  it.each(["/privacy", "/terms", "/support", "/account-deletion"])(
    "allows anonymous GET %s with full security/CSP headers and zero Supabase round-trip",
    async (pathname) => {
      createServerClientMock.mockClear();
      const request = new NextRequest(`https://pekulo.app${pathname}`);
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toContain("default-src");
      expect(createServerClientMock).not.toHaveBeenCalled();
    },
  );

  it.each(["/privacy/", "/terms/", "/support/", "/account-deletion/"])(
    "canonically redirects trailing-slash %s with 308 and CSP headers without calling Supabase",
    async (pathname) => {
      createServerClientMock.mockClear();
      const request = new NextRequest(`https://pekulo.app${pathname}`);
      const response = await proxy(request);

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(`https://pekulo.app${pathname.slice(0, -1)}`);
      expect(response.headers.get("content-security-policy")).toContain("default-src");
      expect(createServerClientMock).not.toHaveBeenCalled();
    },
  );

  it.each(["/privacy-internal", "/privacy/extra"])(
    "does not widen the bypass to non-exact sibling path %s",
    async (pathname) => {
      createServerClientMock.mockReset();
      createServerClientMock.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      });
      const request = new NextRequest(`https://pekulo.app${pathname}`);
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://pekulo.app/login");
      expect(createServerClientMock).toHaveBeenCalledTimes(1);
    },
  );
});

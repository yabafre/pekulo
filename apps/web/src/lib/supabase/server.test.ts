import { describe, expect, test, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn((..._args: unknown[]) => ({ auth: {} })),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ getAll: () => [], set: () => {} })),
}));

import { createClient } from "./server";

describe("supabase server client", () => {
  // AC-1 (verbatim from story 11-7-auth-hardening-httponly-csp:29):
  //   the Supabase session cookie carries HttpOnly and is not readable via
  //   document.cookie. @supabase/ssr defaults httpOnly:false, so the server
  //   client MUST override it — this guards against that override regressing.
  test("AC-1 — server client is built with httpOnly cookie options", async () => {
    await createClient();
    // env vars are undefined under vitest, so assert on the options arg only.
    const options = createServerClient.mock.calls[0]?.[2];
    expect(options).toMatchObject({ cookieOptions: { httpOnly: true } });
  });
});

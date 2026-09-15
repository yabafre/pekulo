import { describe, expect, test } from "bun:test";
import { fakeSupabaseKey, SERVICE_ROLE_KEY_FIXTURE } from "../test/fakes/service-role-key";
import { ConfigError, loadEnv } from "./env";

const BASE = {
  DATABASE_URL: "postgres://x:y@localhost:5432/db",
  SUPABASE_JWT_SECRET: "x".repeat(32),
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY_FIXTURE,
  // Story 5-6 (post-review): BRIDGE_* triple is required at boot — test
  // fixtures must populate them or `loadEnv` throws ConfigError.
  BRIDGE_CLIENT_ID: "test-bridge-client-id",
  BRIDGE_CLIENT_SECRET: "test-bridge-client-secret",
  BRIDGE_WEBHOOK_SIGNING_SECRET: "test-bridge-webhook-secret",
} as const;

describe("loadEnv", () => {
  test("parses minimal env with no price-chain vars", () => {
    const env = loadEnv(BASE);
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
    expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
  });

  test("parses env with all three price-chain vars set", () => {
    const env = loadEnv({
      ...BASE,
      PRICES_SERVICE_URL: "https://prices.internal:8000",
      PRICES_SERVICE_TOKEN: "tok-abc",
      TWELVE_DATA_API_KEY: "td-key",
    });
    expect(env.PRICES_SERVICE_URL).toBe("https://prices.internal:8000");
    expect(env.PRICES_SERVICE_TOKEN).toBe("tok-abc");
    expect(env.TWELVE_DATA_API_KEY).toBe("td-key");
  });

  test("rejects malformed PRICES_SERVICE_URL", () => {
    expect(() => loadEnv({ ...BASE, PRICES_SERVICE_URL: "not-a-url" })).toThrow(ConfigError);
  });

  test("treats empty-string env vars as absent (KEY= in .env)", () => {
    const env = loadEnv({
      ...BASE,
      PRICES_SERVICE_URL: "",
      PRICES_SERVICE_TOKEN: "",
      TWELVE_DATA_API_KEY: "",
      FRANKFURTER_BASE_URL: "",
    });
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
    expect(env.FRANKFURTER_BASE_URL).toBeUndefined();
  });

  // AC-7 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given an `apps/api` process with only the existing required env vars set
  //   AND FRANKFURTER_BASE_URL unset, loadEnv succeeds with
  //   env.FRANKFURTER_BASE_URL === undefined. When FRANKFURTER_BASE_URL=""
  //   the loader treats it as absent. When set, env.FRANKFURTER_BASE_URL
  //   round-trips. No default URL is hard-coded.
  test("parses env with FRANKFURTER_BASE_URL set", () => {
    const env = loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "https://api.frankfurter.app" });
    expect(env.FRANKFURTER_BASE_URL).toBe("https://api.frankfurter.app");
  });

  test("rejects malformed FRANKFURTER_BASE_URL", () => {
    expect(() => loadEnv({ ...BASE, FRANKFURTER_BASE_URL: "not-a-url" })).toThrow(ConfigError);
  });

  // Story 5-6 — BRIDGE_CLIENT_ID / BRIDGE_CLIENT_SECRET / BRIDGE_WEBHOOK_SIGNING_SECRET
  // are required at boot. Removing any of them must surface ConfigError so a
  // missing-credentials deploy fails fast at start-up, not at the first user
  // click.
  test("rejects missing BRIDGE_CLIENT_ID", () => {
    const { BRIDGE_CLIENT_ID: _, ...rest } = BASE;
    expect(() => loadEnv(rest)).toThrow(ConfigError);
  });

  test("rejects missing BRIDGE_CLIENT_SECRET", () => {
    const { BRIDGE_CLIENT_SECRET: _, ...rest } = BASE;
    expect(() => loadEnv(rest)).toThrow(ConfigError);
  });

  test("rejects missing BRIDGE_WEBHOOK_SIGNING_SECRET", () => {
    const { BRIDGE_WEBHOOK_SIGNING_SECRET: _, ...rest } = BASE;
    expect(() => loadEnv(rest)).toThrow(ConfigError);
  });

  // Story 11-2 (FR-50) — the Auth Admin key is the only credential that can
  // erase a Supabase Auth user. A deployment without it must fail at boot,
  // not at the first deletion, after the user's data is already gone.
  test("rejects missing SUPABASE_SERVICE_ROLE_KEY", () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _, ...rest } = BASE;
    expect(() => loadEnv(rest)).toThrow(ConfigError);
  });

  // aped-review 11-2: a wrong-but-long value used to boot and only fail inside
  // auth.admin.deleteUser — after the Bridge user and every local row were
  // already gone. The key must LOOK like a service-role credential at boot.
  test("rejects a JWT whose role is not service_role (the anon key)", () => {
    expect(() => loadEnv({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: fakeSupabaseKey("anon") })).toThrow(
      ConfigError,
    );
  });

  test("rejects an opaque string that is neither a JWT nor an sb_secret_ key (the JWT secret)", () => {
    expect(() => loadEnv({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: "x".repeat(40) })).toThrow(
      ConfigError,
    );
  });

  test("accepts the newer sb_secret_ key shape", () => {
    const env = loadEnv({ ...BASE, SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${"y".repeat(32)}` });
    expect(env.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")).toBe(true);
  });

  test("accepts BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS as optional (24h rotation window)", () => {
    const env = loadEnv({ ...BASE, BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: "old-secret" });
    expect(env.BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS).toBe("old-secret");
  });
});

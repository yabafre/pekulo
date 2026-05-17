import { describe, expect, test } from "bun:test";
import { ConfigError, loadEnv } from "./env";

const BASE = {
  DATABASE_URL: "postgres://x:y@localhost:5432/db",
  SUPABASE_JWT_SECRET: "x".repeat(32),
  SUPABASE_URL: "https://example.supabase.co",
} as const;

describe("loadEnv", () => {
  test("parses minimal env with no price-chain vars", () => {
    const env = loadEnv(BASE);
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
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
    });
    expect(env.PRICES_SERVICE_URL).toBeUndefined();
    expect(env.PRICES_SERVICE_TOKEN).toBeUndefined();
    expect(env.TWELVE_DATA_API_KEY).toBeUndefined();
  });
});

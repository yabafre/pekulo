import { z } from "@pekulo/zod";

// Treat `KEY=` in .env as absent — brownfield reads process.env directly and
// `""` is falsy. Without this, optional URL / non-empty schemas reject the
// shell-truthy-but-content-empty pattern with a confusing validation error.
const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z
    .string()
    .min(32, "SUPABASE_JWT_SECRET must be ≥ 32 chars (read it from `bunx supabase status`)"),
  // Supabase project URL — used to derive the JWT issuer
  // (`<SUPABASE_URL>/auth/v1`) for `iss` claim verification (ADR-0013
  // belt+suspenders). The value is the same as `NEXT_PUBLIC_SUPABASE_URL` on
  // the web tier; it lives here too so apps/api can run independently.
  SUPABASE_URL: z.string().url(),
  // Price-chain providers (story 3-2). All optional — when unset, the
  // corresponding tier throws a typed `not-configured` / `missing-key`
  // error and the orchestrator falls back to the next tier.
  PRICES_SERVICE_URL: optionalString(z.string().url()),
  PRICES_SERVICE_TOKEN: optionalString(z.string().min(1)),
  TWELVE_DATA_API_KEY: optionalString(z.string().min(1)),
  // FX provider (story 3-3, FR-18). Best-effort: when unset, the snapshot
  // computes with `fxSource: 'fallback'` (1:1 identity, per NFR-19). No
  // default URL — explicit opt-in mirrors PRICES_SERVICE_URL.
  FRANKFURTER_BASE_URL: optionalString(z.string().url()),
  // LLM providers (story 6-1, FR-31 ; provider config extended in 6-4 on
  // 2026-05-31). All optional. Ollama defaults to the localhost Dokploy bind +
  // qwen2.5:3b. The third-party route is OpenAI-compatible and defaults to
  // Mistral La Plateforme (EU-hosted, RGPD-friendly); its key lives ONLY in
  // Dokploy env (unset → LLM_PROVIDER_UNAVAILABLE). For dev/test model
  // comparison, point THIRD_PARTY_LLM_BASE_URL at OpenRouter
  // (https://openrouter.ai/api/v1/chat/completions) and swap THIRD_PARTY_LLM_MODEL.
  OLLAMA_BASE_URL: optionalString(z.string().url()),
  OLLAMA_MODEL: optionalString(z.string().min(1)),
  THIRD_PARTY_LLM_API_KEY: optionalString(z.string().min(1)),
  THIRD_PARTY_LLM_BASE_URL: optionalString(z.string().url()),
  THIRD_PARTY_LLM_MODEL: optionalString(z.string().min(1)),
  // OTel SDK config (story 0-7 — ADR-0005). All three are optional with
  // safe defaults so brownfield .env files keep working.
  OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString(z.string().url()),
  OTEL_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
  // Bridge bank-aggregator (story 5-6 — ADR-0015). The three credentials are
  // REQUIRED — boot fails fast when missing (post-review aped-review: silent
  // start-without-credentials would only surface as 503 on the first user
  // click, by which point the deploy is live). BRIDGE_CLIENT_SECRET lives
  // ONLY in Dokploy env — never on apps/web.
  //
  // Local dev / NODE_ENV=test: set placeholder values in .env or pass them
  // via process.env when running `bun test` ; the spec test
  // `apps/api/src/config/env.test.ts` documents the required surface.
  // PREVIOUS_SECRET stays optional — only set during the 24h rotation overlap.
  BRIDGE_CLIENT_ID: z.string().min(1, "BRIDGE_CLIENT_ID is required (Bridge developer Client-Id)"),
  BRIDGE_CLIENT_SECRET: z.string().min(1, "BRIDGE_CLIENT_SECRET is required (Dokploy env only)"),
  BRIDGE_WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(1, "BRIDGE_WEBHOOK_SIGNING_SECRET is required (HMAC-SHA256 webhook secret)"),
  BRIDGE_WEBHOOK_SIGNING_SECRET_PREVIOUS: optionalString(z.string().min(1)),
  BRIDGE_API_BASE: z.string().url().default("https://api.bridgeapi.io"),
  BRIDGE_API_VERSION: z.string().min(1).default("2025-01-15"),
  BRIDGE_REFRESH_CRON_HOURS: z.coerce.number().int().positive().max(168).default(6),
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly fieldErrors: Record<string, string[] | undefined>;
  constructor(fieldErrors: Record<string, string[] | undefined>) {
    super(`invalid env: ${JSON.stringify(fieldErrors)}`);
    this.fieldErrors = fieldErrors;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

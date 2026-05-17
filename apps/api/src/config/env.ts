import { z } from "zod";

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
  // OTel SDK config (story 0-7 — ADR-0005). All three are optional with
  // safe defaults so brownfield .env files keep working.
  OTEL_SERVICE_NAME: z.string().min(1).default("pekulo-api"),
  OTEL_EXPORTER_OTLP_ENDPOINT: optionalString(z.string().url()),
  OTEL_LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("error"),
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

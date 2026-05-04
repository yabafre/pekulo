import { z } from "zod";

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

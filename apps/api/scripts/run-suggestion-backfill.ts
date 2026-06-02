// apps/api/scripts/run-suggestion-backfill.ts
// One-shot ops trigger for the LLM-categorisation sweep (épic 6). Same code path
// the hourly scheduler runs (transactionsService.backfillAllUsers), wired with
// the real runtime deps — for draining the backlog on demand without waiting an
// hour. Reads env from the repo-root .env / .env.local (prisma.config pattern).
//
//   bun apps/api/scripts/run-suggestion-backfill.ts [maxUsers] [limitPerUser]
//
// Ollama OFF + a user opted in → categorisation escalates to the third-party
// route (real egress + cost). Ollama OFF + not opted in → clean abstention
// (rows stamped attempted, not retried). Bounded by the args (default 50/200).
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env";
import { createRuntimeDependencies } from "../src/bootstrap/runtime-dependencies";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
dotenvConfig({ path: resolve(REPO_ROOT, ".env.local") });
dotenvConfig({ path: resolve(REPO_ROOT, ".env") });

const maxUsers = Number(process.argv[2] ?? 50);
const limitPerUser = Number(process.argv[3] ?? 200);

const env = loadEnv();
const deps = await createRuntimeDependencies({ env });

console.log(`[backfill] sweeping up to ${maxUsers} user(s) × ${limitPerUser} row(s)…`);
try {
  const summary = await deps.transactionsModule.service.backfillAllUsers(maxUsers, limitPerUser);
  console.log(
    `[backfill] done — users swept: ${summary.users}, suggestions written: ${summary.suggested}, categories auto-applied (csv/bridge, 6-7): ${summary.applied}`,
  );
} finally {
  // Don't start the scheduler in a one-shot; just drain the pool and exit.
  await deps.prismaService.disconnect();
}

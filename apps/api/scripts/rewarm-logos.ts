// apps/api/scripts/rewarm-logos.ts
// One-shot ops trigger for the transaction-logo caches (story 6-10 / FR-65).
// Same code path as the bank-refresh warm-up (bankAggregatorService.backfillUserLogos),
// wired with the real runtime deps — for re-resolving logos on demand after the
// curated merchant map changes, without waiting for a refresh tick.
//
//   bun apps/api/scripts/rewarm-logos.ts [--clear-misses]
//
// --clear-misses deletes the NEGATIVE merchant cache rows (logo_url IS NULL)
// first, so past Brandfetch misses are re-resolved through the (possibly newly
// extended) curated map instead of being served from the negative cache until
// their TTL elapses. Provider (bank) logos are positive-only, left untouched.
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env";
import { createRuntimeDependencies } from "../src/bootstrap/runtime-dependencies";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
dotenvConfig({ path: resolve(REPO_ROOT, ".env.local") });
dotenvConfig({ path: resolve(REPO_ROOT, ".env") });

const clearMisses = process.argv.includes("--clear-misses");

const env = loadEnv();
const deps = await createRuntimeDependencies({ env });
const client = deps.prismaService.client;

try {
  if (clearMisses) {
    const { count } = await client.merchantLogoCache.deleteMany({ where: { logoUrl: null } });
    console.log(`[rewarm-logos] cleared ${count} negative merchant-cache row(s)`);
  }
  // oxlint-disable-next-line pekulo/no-prisma-query-without-user-id -- ops sweep: enumerate distinct userIds across ALL users (cross-user by design; selects only the id column, no user data read)
  const users = await client.account.findMany({ select: { userId: true }, distinct: ["userId"] });
  let merchants = 0;
  let providers = 0;
  for (const { userId } of users) {
    // oxlint-disable-next-line no-await-in-loop -- serial by design: per-user warm, best-effort, bounded by user count
    const r = await deps.bankAggregatorModule.service.backfillUserLogos(userId);
    merchants += r.merchants;
    providers += r.providers;
    console.log(
      `[rewarm-logos] user ${userId}: ${r.merchants} label(s), ${r.providers} provider(s)`,
    );
  }
  console.log(
    `[rewarm-logos] done — ${users.length} user(s); ${merchants} label(s) + ${providers} provider(s) warmed`,
  );
} finally {
  await deps.prismaService.disconnect();
}

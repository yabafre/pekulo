// cleanup-bridge-dupes.ts — one-shot remediation for the pre-fix Bridge
// duplicate-accounts bug (story 5-7 FIX 2026-05-28).
//
// Before the IBAN-keying fix, every "Connecter une banque" minted a NEW Bridge
// item with NEW account ids, and accounts were keyed on that volatile id —
// so reconnecting the same bank duplicated all its accounts (one demo user
// accumulated 6 items × the same accounts). Those existing rows are keyed by
// the OLD volatile id and won't match the new IBAN keying, so the clean fix on
// this sandbox data is to wipe the Bridge-sourced rows and let the user
// reconnect ONCE under the corrected keying.
//
// Deletes (FK-safe order), scoped to provider='bridge':
//   transactions on bridge accounts → account_balance_log on them →
//   bridge accounts → bank_connections.
// PRESERVES bridge_users (the Pekulo↔Bridge UUID mapping is reusable).
// Does NOT revoke items on Bridge's side — the orphaned sandbox items are
// harmless (Pekulo only syncs items it has a bank_connections row for).
//
// Usage:
//   bun run apps/api/scripts/cleanup-bridge-dupes.ts            # DRY RUN (default)
//   bun run apps/api/scripts/cleanup-bridge-dupes.ts --apply    # actually delete

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
for (const filename of [".env.local", ".env"]) {
  const result = dotenvConfig({ path: resolve(REPO_ROOT, filename) });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.warn(`[cleanup-bridge] dotenv failed to load ${filename}: ${result.error.message}`);
  }
}

const APPLY = process.argv.includes("--apply");
const BRIDGE_ACCT_IDS = `SELECT id FROM accounts WHERE provider = 'bridge'`;

async function main(): Promise<number> {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();

    const conns = await client.query<{
      id: string;
      provider_item_id: string;
      status: string;
      display_name: string | null;
    }>(
      `SELECT id, provider_item_id, status, display_name FROM bank_connections
       WHERE provider = 'bridge' ORDER BY created_at`,
    );
    const acct = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM accounts WHERE provider = 'bridge'`,
    );
    const txn = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM transactions WHERE account_id IN (${BRIDGE_ACCT_IDS})`,
    );
    const buser = await client.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bridge_users`);

    console.log("── Bridge data currently in the DB ──");
    console.log(`bank_connections (provider=bridge): ${conns.rows.length}`);
    for (const c of conns.rows) {
      console.log(
        `  • ${c.id} item=${c.provider_item_id} status=${c.status} name=${c.display_name ?? "—"}`,
      );
    }
    console.log(`bridge accounts: ${acct.rows[0]?.n}`);
    console.log(`transactions on bridge accounts: ${txn.rows[0]?.n}`);
    console.log(`bridge_users (PRESERVED): ${buser.rows[0]?.n}`);

    if (!APPLY) {
      console.log(
        "\nDRY RUN — nothing deleted. Re-run with --apply to wipe the Bridge-sourced rows " +
          "(bridge_users mapping is kept). Then reconnect once to re-sync cleanly.",
      );
      return 0;
    }

    await client.query("BEGIN");
    const dTx = await client.query(
      `DELETE FROM transactions WHERE account_id IN (${BRIDGE_ACCT_IDS})`,
    );
    const dBal = await client.query(
      `DELETE FROM account_balance_log WHERE account_id IN (${BRIDGE_ACCT_IDS})`,
    );
    const dAcc = await client.query(`DELETE FROM accounts WHERE provider = 'bridge'`);
    const dConn = await client.query(`DELETE FROM bank_connections WHERE provider = 'bridge'`);
    await client.query("COMMIT");

    console.log(
      `\nDELETED — transactions: ${dTx.rowCount}, balance-log: ${dBal.rowCount}, ` +
        `accounts: ${dAcc.rowCount}, bank_connections: ${dConn.rowCount}. ` +
        "bridge_users preserved. Reconnect the bank once to re-sync cleanly " +
        "(now deduped by IBAN; a same-bank re-connect is rejected as already-synced).",
    );
    return 0;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[cleanup-bridge] failed:", err instanceof Error ? err.message : err);
    return 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().then((code) => process.exit(code));

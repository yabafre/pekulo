// apps/api/scripts/seed-portfolio-demo.ts
// One-shot dev-only seed for the Portefeuille demo (story 3-4).
//
// Creates 2 accounts (PEA Boursorama + CTO Trade Republic) + 6 holdings
// (CW8, PE500, VWCE, AAPL, BTC, ETH) for the first user in auth.users.
// Idempotent on the (userId, label) tuple — skips if a row with the same
// label already exists for the user.
//
// Usage:
//   bun apps/api/scripts/seed-portfolio-demo.ts [userId]
//
// If `userId` is omitted, picks the first row from auth.users (Pekulo's
// V1 (a) personal-use phase has a single user).

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
for (const filename of [".env.local", ".env"]) {
  dotenvConfig({ path: resolve(REPO_ROOT, filename) });
}

const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DIRECT_URL or DATABASE_URL not set");
  process.exit(1);
}

function base62(): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let out = "";
  const bytes = new Uint8Array(21);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 21; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

const accId = () => `acc_${base62()}`;
const hldId = () => `hld_${base62()}`;

type AccountSeed = {
  label: string;
  type: "pea" | "cto" | "livret" | "av" | "autre";
  currency: "EUR" | "USD" | "GBP" | "CHF";
  cashBalance: number;
};

type HoldingSeed = {
  accountLabel: string;
  kind: "etf" | "action" | "crypto" | "autre";
  ticker: string;
  label: string;
  currency: "EUR" | "USD" | "GBP" | "CHF";
  quantity: number;
  avgCost: number;
  lastPrice: number;
};

const ACCOUNTS: AccountSeed[] = [
  { label: "PEA Boursorama", type: "pea", currency: "EUR", cashBalance: 1200 },
  { label: "CTO Trade Republic", type: "cto", currency: "EUR", cashBalance: 500 },
];

const HOLDINGS: HoldingSeed[] = [
  // PEA — ETFs
  {
    accountLabel: "PEA Boursorama",
    kind: "etf",
    ticker: "CW8",
    label: "Amundi MSCI World",
    currency: "EUR",
    quantity: 42,
    avgCost: 480,
    lastPrice: 542.3,
  },
  {
    accountLabel: "PEA Boursorama",
    kind: "etf",
    ticker: "PE500",
    label: "Amundi PEA S&P 500",
    currency: "EUR",
    quantity: 18,
    avgCost: 32.5,
    lastPrice: 38.92,
  },
  // CTO — international ETF + actions + crypto
  {
    accountLabel: "CTO Trade Republic",
    kind: "etf",
    ticker: "VWCE",
    label: "Vanguard FTSE All-World",
    currency: "EUR",
    quantity: 25,
    avgCost: 105.6,
    lastPrice: 124.45,
  },
  {
    accountLabel: "CTO Trade Republic",
    kind: "action",
    ticker: "AAPL",
    label: "Apple Inc.",
    currency: "USD",
    quantity: 12,
    avgCost: 165.4,
    lastPrice: 232.1,
  },
  {
    accountLabel: "CTO Trade Republic",
    kind: "crypto",
    ticker: "BTC-USD",
    label: "Bitcoin",
    currency: "USD",
    quantity: 0.08,
    avgCost: 45000,
    lastPrice: 89200,
  },
  {
    accountLabel: "CTO Trade Republic",
    kind: "crypto",
    ticker: "ETH-USD",
    label: "Ethereum",
    currency: "USD",
    quantity: 0.6,
    avgCost: 2400,
    lastPrice: 3120,
  },
];

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const argUserId = process.argv[2];
  let userId: string;
  if (argUserId) {
    userId = argUserId;
  } else {
    const r = await client.query<{ id: string; email: string | null }>(
      "SELECT id, email FROM auth.users ORDER BY created_at ASC LIMIT 1",
    );
    if (r.rowCount === 0) {
      console.error("No user found in auth.users. Sign up via the app first, then re-run.");
      process.exit(1);
    }
    userId = r.rows[0]!.id;
    console.log(`[seed] using first user: ${userId} (${r.rows[0]!.email ?? "no email"})`);
  }

  // 1) Accounts — idempotent on (user_id, label)
  const accountIdByLabel = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM accounts WHERE user_id = $1 AND label = $2 LIMIT 1",
      [userId, a.label],
    );
    if (existing.rowCount === 1) {
      accountIdByLabel.set(a.label, existing.rows[0]!.id);
      console.log(`[seed] account exists: ${a.label} (${existing.rows[0]!.id})`);
      continue;
    }
    const id = accId();
    await client.query(
      `INSERT INTO accounts (id, user_id, label, type, currency, cash_balance, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NOW(), NOW())`,
      [id, userId, a.label, a.type, a.currency, a.cashBalance],
    );
    accountIdByLabel.set(a.label, id);
    console.log(`[seed] account created: ${a.label} (${id})`);
  }

  // 2) Holdings — idempotent on (user_id, label)
  for (const h of HOLDINGS) {
    const accId2 = accountIdByLabel.get(h.accountLabel);
    if (!accId2) {
      console.error(`[seed] no account id for label "${h.accountLabel}" — skipping ${h.ticker}`);
      continue;
    }
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM holdings WHERE user_id = $1 AND label = $2 LIMIT 1",
      [userId, h.label],
    );
    if (existing.rowCount === 1) {
      console.log(`[seed] holding exists: ${h.ticker} (${existing.rows[0]!.id})`);
      continue;
    }
    const id = hldId();
    await client.query(
      `INSERT INTO holdings
       (id, user_id, account_id, kind, ticker, isin, label, currency,
        quantity, avg_cost, last_price, last_price_at, notes,
        created_at, updated_at, closed_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7,
               $8, $9, $10, CURRENT_DATE, NULL,
               NOW(), NOW(), NULL)`,
      [
        id,
        userId,
        accId2,
        h.kind,
        h.ticker,
        h.label,
        h.currency,
        h.quantity,
        h.avgCost,
        h.lastPrice,
      ],
    );
    console.log(`[seed] holding created: ${h.ticker} ${h.label} (${id})`);
  }

  console.log("[seed] done");
} finally {
  await client.end();
}

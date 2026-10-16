// apps/web/e2e/global-setup.ts
// Playwright globalSetup (story 11-4, AC-4):
//   1. Signs up a throwaway user via GoTrue's public /auth/v1/signup endpoint
//      using only NEXT_PUBLIC_SUPABASE_ANON_KEY (GOTRUE_MAILER_AUTOCONFIRM=true
//      in the local E2E stack). No service-role key is read in apps/web.
//   2. Seeds portfolio demo rows (1 PEA account + 3 holdings: ETF, action,
//      crypto with positive and negative deltas) via direct SQL over
//      DATABASE_URL so /dashboard/portefeuille renders real HoldingRow and
//      chromatic delta surfaces in both dark and light themes.
//   3. Logs in through the real /login form in Chromium, verifies the redirect
//      to /dashboard, and writes the authenticated storageState to
//      apps/web/e2e/.auth/user.json.
import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  E2E_ANON_KEY,
  E2E_DATABASE_URL,
  E2E_SUPABASE_URL,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
  E2E_WEB_URL,
} from "./e2e-env";

// Playwright transpiles this file to CJS (apps/web/package.json has no
// "type": "module"), so ESM-only module metadata syntax is a load-time
// SyntaxError. Derive the path from the resolved config file instead — same
// value whichever module format the loader picks.
export function resolveStorageStatePath(configFile?: string): string {
  const configDir = configFile ? dirname(configFile) : process.cwd();
  return join(configDir, "e2e", ".auth", "user.json");
}

async function ensureThrowawayUser(): Promise<string> {
  const signUpRes = await fetch(`${E2E_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: E2E_ANON_KEY,
      Authorization: `Bearer ${E2E_ANON_KEY}`,
    },
    body: JSON.stringify({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    }),
  });

  if (signUpRes.ok) {
    const body = (await signUpRes.json()) as { id?: string; user?: { id?: string } };
    const userId = body.user?.id ?? body.id;
    if (userId) return userId;
  }

  // User may already exist from a prior local run — sign in via token endpoint
  // to recover the user ID.
  const tokenRes = await fetch(`${E2E_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: E2E_ANON_KEY,
      Authorization: `Bearer ${E2E_ANON_KEY}`,
    },
    body: JSON.stringify({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`[e2e global-setup] Failed to create or sign in throwaway user: ${text}`);
  }
  const tokenBody = (await tokenRes.json()) as { user?: { id?: string } };
  if (!tokenBody.user?.id) {
    throw new Error("[e2e global-setup] Token response missing user.id");
  }
  return tokenBody.user.id;
}

async function seedPortfolioDemoRows(userId: string): Promise<void> {
  // pg over TCP — Playwright's runner executes this file under Node (never
  // Bun), so `import("bun")` / Bun.sql is unavailable. pg + @types/pg are
  // devDependencies mirrored from apps/api (same lockfile entries).
  const { Client } = await import("pg");
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const accountId = "acc_e2eAxeDemoPea000001";
    await client.query(
      `INSERT INTO accounts (id, user_id, label, type, currency, cash_balance)
       VALUES ($1, $2::uuid, 'PEA Bourse Direct', 'pea', 'EUR', 1250.00)
       ON CONFLICT (id) DO NOTHING`,
      [accountId, userId],
    );
    await client.query(
      `INSERT INTO holdings (id, user_id, account_id, kind, ticker, isin, label, currency, quantity, avg_cost, last_price)
       VALUES
         ('hld_e2eAxeDemoCw8000001', $1::uuid, $2, 'etf', 'CW8.PA', 'LU1681043599', 'Amundi MSCI World UCITS ETF', 'EUR', 25, 420.00, 512.40),
         ('hld_e2eAxeDemoAir000002', $1::uuid, $2, 'action', 'AI.PA', 'FR0000120073', 'Air Liquide', 'EUR', 10, 175.00, 168.20),
         ('hld_e2eAxeDemoBtc000003', $1::uuid, $2, 'crypto', 'BTC-EUR', NULL, 'Bitcoin', 'EUR', 0.15, 52000.00, 61500.00)
       ON CONFLICT (id) DO NOTHING`,
      [userId, accountId],
    );
  } finally {
    await client.end();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const storageStatePath = resolveStorageStatePath(config.configFile);
  mkdirSync(dirname(storageStatePath), { recursive: true });
  const userId = await ensureThrowawayUser();
  await seedPortfolioDemoRows(userId);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: E2E_WEB_URL });
  const page = await context.newPage();
  try {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.locator("input#email").fill(E2E_USER_EMAIL);
    await page.locator("input#password").fill(E2E_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 30_000 });
    await context.storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}

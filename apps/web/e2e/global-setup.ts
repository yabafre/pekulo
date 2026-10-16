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
import { fileURLToPath } from "node:url";
import {
  E2E_ANON_KEY,
  E2E_DATABASE_URL,
  E2E_SUPABASE_URL,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
  E2E_WEB_URL,
} from "./e2e-env";

const HERE = dirname(fileURLToPath(import.meta.url));
export const STORAGE_STATE_PATH = join(HERE, ".auth", "user.json");

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
  // Use Bun.sql (built into Bun runtime) or dynamic pg import via apps/api
  // workspace so apps/web needs no extra DB driver dependency.
  const { SQL } = await import("bun");
  const sql = new SQL(E2E_DATABASE_URL);
  try {
    const accountId = "acc_e2eAxeDemoPea000001";
    await sql`
      INSERT INTO accounts (id, user_id, label, type, currency, cash_balance)
      VALUES (${accountId}, ${userId}::uuid, 'PEA Bourse Direct', 'pea', 'EUR', 1250.00)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO holdings (id, user_id, account_id, kind, ticker, isin, label, currency, quantity, avg_cost, last_price)
      VALUES
        ('hld_e2eAxeDemoCw8000001', ${userId}::uuid, ${accountId}, 'etf', 'CW8.PA', 'LU1681043599', 'Amundi MSCI World UCITS ETF', 'EUR', 25, 420.00, 512.40),
        ('hld_e2eAxeDemoAir000002', ${userId}::uuid, ${accountId}, 'action', 'AI.PA', 'FR0000120073', 'Air Liquide', 'EUR', 10, 175.00, 168.20),
        ('hld_e2eAxeDemoBtc000003', ${userId}::uuid, ${accountId}, 'crypto', 'BTC-EUR', NULL, 'Bitcoin', 'EUR', 0.15, 52000.00, 61500.00)
      ON CONFLICT (id) DO NOTHING
    `;
  } finally {
    await sql.close();
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
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
    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await browser.close();
  }
}

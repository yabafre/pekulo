// apps/web/playwright.config.ts
// Playwright config for the route-level axe-core WCAG 2.2 AA gate (story 11-4).
import { defineConfig } from "@playwright/test";
import { E2E_WEB_URL } from "./e2e/e2e-env";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /axe-routes\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E_WEB_URL,
    trace: "retain-on-failure",
  },
  timeout: 60_000,
});

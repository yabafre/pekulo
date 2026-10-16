// apps/web/e2e/axe-routes.spec.ts
// Route-level axe-core WCAG 2.2 AA CI gate across all 7 priority routes ×
// {dark desktop, light desktop, dark mobile} in real Chromium (story 11-4,
// AC-1, AC-4, DR-8, NFR-22, NFR-23, NFR-24).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { formatAxeViolations } from "./axe-format";
import { resolveStorageStatePath } from "./global-setup";

const AUTHENTICATED_ROUTES = [
  "/dashboard",
  "/dashboard/transactions",
  "/dashboard/mensuel",
  "/dashboard/portefeuille",
  "/dashboard/immobilier",
  "/dashboard/parametres",
] as const;

const ALL_PRIORITY_ROUTES = [...AUTHENTICATED_ROUTES, "/login"] as const;

interface ViewportProfile {
  name: "dark-desktop" | "light-desktop" | "dark-mobile";
  theme: "pekulo-dark" | "pekulo-light";
  viewport: { width: number; height: number };
}

const PROFILES: readonly ViewportProfile[] = [
  { name: "dark-desktop", theme: "pekulo-dark", viewport: { width: 1280, height: 800 } },
  { name: "light-desktop", theme: "pekulo-light", viewport: { width: 1280, height: 800 } },
  { name: "dark-mobile", theme: "pekulo-dark", viewport: { width: 390, height: 844 } },
];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function applyThemeAndWaitForIdle(
  page: Page,
  theme: ViewportProfile["theme"],
): Promise<void> {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("theme", t === "pekulo-light" ? "light" : "dark");
    } catch {
      // ignore storage errors on about:blank
    }
  }, theme);
}

async function forceDocumentTheme(page: Page, theme: ViewportProfile["theme"]): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = t === "pekulo-light" ? "light" : "dark";
  }, theme);
  // Allow the 280ms theme transition in reset.css to settle (or instant under reduced-motion).
  await page.waitForTimeout(50);
}

test.describe("axe-core WCAG 2.2 AA gate across the 7 priority routes (AC-1, AC-4)", () => {
  for (const profile of PROFILES) {
    test.describe(`profile: ${profile.name}`, () => {
      for (const route of ALL_PRIORITY_ROUTES) {
        const isLogin = route === "/login";
        test(`${route} (${profile.name}) has zero serious/critical axe violations`, async ({
          browser,
        }) => {
          const context = await browser.newContext({
            viewport: profile.viewport,
            reducedMotion: "reduce",
            storageState: isLogin
              ? undefined
              : resolveStorageStatePath(test.info().config.configFile),
          });
          const page = await context.newPage();
          try {
            await applyThemeAndWaitForIdle(page, profile.theme);
            await page.goto(route, { waitUntil: "networkidle" });
            await forceDocumentTheme(page, profile.theme);

            if (!isLogin) {
              // AC-4: authenticated routes must NOT redirect to /login.
              expect(new URL(page.url()).pathname).toBe(route);
              await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
            } else {
              await expect(page.locator("form input#email")).toBeVisible({ timeout: 15_000 });
            }

            // Wait for any skeleton status indicator to settle so real text/contrasts are scanned.
            const skeletons = page.locator('[role="status"][aria-live="polite"]');
            if ((await skeletons.count()) > 0) {
              await skeletons
                .first()
                .waitFor({ state: "detached", timeout: 15_000 })
                .catch(() => {});
            }

            const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
            const formatted = formatAxeViolations(route, profile.name, results.violations);
            expect(formatted, formatted).toBe("");
          } finally {
            await context.close();
          }
        });
      }
    });
  }

  test("AC-1 negative probe: injected contrast violation on /login is caught with rule, selector, and HTML", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.evaluate(() => {
        const probe = document.createElement("p");
        probe.id = "axe-contrast-probe";
        probe.textContent = "Low contrast probe";
        probe.style.color = "#222222";
        probe.style.backgroundColor = "#000000";
        probe.style.fontSize = "14px";
        document.body.appendChild(probe);
      });

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const formatted = formatAxeViolations("/login", "dark-desktop", results.violations);
      expect(formatted).toContain("rule: color-contrast (serious)");
      expect(formatted).toContain("selector: #axe-contrast-probe");
      expect(formatted).toContain('id="axe-contrast-probe"');
    } finally {
      await context.close();
    }
  });
});

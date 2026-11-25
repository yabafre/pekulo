---
storyKey: 10-7-store-compliance-and-agent-testers
epic: 10
ticket: "#163"
branch: feature/163-10-7-store-compliance-and-agent-testers
status: review
complexity: L
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Story: 10-7-store-compliance-and-agent-testers — App Store / Google Play pre-submission compliance hardening & Mobile Agent Testers kit

**Epic:** Epic 10 — Design system parity (V1.5)
**Status:** review
**Ticket:** [#163](https://github.com/yabafre/pekulo/issues/163)
**Branch:** `feature/163-10-7-store-compliance-and-agent-testers`
**Depends on:** 10-5-mobile-parity-and-maestro (done; runs in parallel with 10-6-android-parity-and-maestro)
**Covered FRs / DRs / NFRs:** FR-34, FR-50, FR-55, FR-56, DR-5, DR-7, DR-8, DR-12, NFR-12, NFR-13, NFR-22
**Complexity:** L

## User Story

**As a** Pekulo user and app publisher, **I want** public web legal and account-deletion pages, an accurate iOS Privacy Manifest, export-compliance config, canonical RGB no-alpha app icons, Keychain iCloud-backup exclusion, a release-mode backend fail-fast guard, Apple 5.1.2(i) third-party AI consent + EU AI Act Art. 50 notice on mobile, tactile haptics, and a ready-to-run Mobile Agent Testers kit, **so that** Pekulo V1.5 passes Apple App Store and Google Play pre-submission compliance audits cleanly without preventable rejections.

## Acceptance Criteria

- **AC-1 (Public legal & deletion web pages — Apple 5.1.1, Google Data Safety, EAA Annex V)** — **Given** an unauthenticated or authenticated visitor, **When** they request `/privacy`, `/terms`, `/support`, or `/account-deletion` on the web app, **Then** the edge proxy serves the exact path with HTTP 200 and full security/CSP headers without calling Supabase authentication or redirecting to `/login` (while non-exact sibling paths remain protected); **And** each page renders using the Pekulo Design System only (zero app-local Tailwind classes) covering GDPR/CNIL data processing, sub-processors (Supabase, Bridge, optional LLM), EAA Annex V accessibility notice, support contact, and step-by-step in-app and web account-deletion instructions.
- **AC-2 (In-app legal links on mobile — Apple 5.1.1)** — **Given** a mobile user on the Sign-in or Settings screen, **When** the screen renders, **Then** localized (French and English) links to Privacy Policy, Terms of Service, and Support open the canonical HTTPS URLs (defaulting to `https://pekulo.app` when no HTTPS override is configured) in the system browser.
- **AC-3 (Privacy Manifest, Export Compliance & RGB no-alpha Icons — Apple 5.1.1 / 5.1.2 / ITMS-90717)** — **Given** the mobile Expo configuration and committed brand assets, **When** a native build or compliance check runs, **Then** non-exempt encryption is declared `false`, tablet support remains enabled, the iOS Privacy Manifest declares tracking disabled, required-reason API categories (`CA92.1`, `C617.1`, `35F9.1`), and collected data types covering Email Address and Financial Info (linked to user, App Functionality only); **And** the primary app icon is a 1024×1024 RGB PNG with no alpha channel, paired with Android adaptive icon and splash assets.
- **AC-4 (Keychain backup exclusion & release fail-fast guard — Mobile Security 2026, Apple 2.1)** — **Given** a mobile session written to secure storage, **When** any token or chunk is persisted, **Then** the Keychain accessibility option restricts it to the current device after first unlock so tokens are excluded from iCloud backups; **And** **Given** a release mobile build with Supabase environment variables missing and preview mode not explicitly opted in, **When** authentication initialises, **Then** the app fails fast with an explicit configuration error rather than silently entering preview mode, while end-to-end test preview builds continue to opt in explicitly.
- **AC-5 (Apple 5.1.2(i) third-party AI consent modal & EU AI Act Art. 50 notice on mobile — DR-7, DR-12, NFR-12)** — **Given** an authenticated mobile user in Settings turning third-party AI models on, **When** the toggle switches from off to on, **Then** an explicit consent dialog names the configured third-party AI provider and the exact data fields transmitted (transaction label, amount, currency, date — zero personal identifiers or account numbers), persists the opt-in only after confirmation, and invalidates the AI notice cache; turning third-party AI off disables immediately without a modal; **And** **Given** an authenticated mobile user viewing pending AI category suggestions on Transactions who has not yet seen the AI transparency notice, **When** the screen renders, **Then** the AI transparency banner appears once, records seen status on the server, remains visible until explicitly dismissed, and hides on dismissal.
- **AC-6 (Tactile haptics & release readiness kit — Apple HIG Accessibility)** — **Given** a mobile mutation completing (success or failure) or a destructive confirmation prompt opening, **When** the interaction fires, **Then** the corresponding non-throwing haptic feedback triggers; **And** the mobile app ships an English release-readiness attestation manifest and App Review Notes document tracking every manual store prerequisite (demo account, live backend, Universal Links deferred until Apple Team ID is assigned, DSA trader status, Organization D-U-N-S, iPad 13-inch screenshots).
- **AC-7 (Mobile Agent Testers kit & vendored skills)** — **Given** the mobile agent-testing configuration, **Then** an English persona catalog (8 FR/EN personas: 4 iOS and 4 Android), mission brief, and setup guide tailored to Pekulo's public Bun/Expo monorepo (free GitHub hosted runners, custom Bun build commands, 4–6 persona batching, encrypted public logs, local-terminal setup/collection) are committed alongside the vendored `app-store-compliance` and `mobile-agent-testers` skills.
- **AC-8 (Compliance meta-test, quality gates & doc sync)** — **Given** the finished change, **When** typecheck, lint, format check, web unit tests, and mobile Jest tests run, **Then** all pass including an automated store-compliance test asserting export compliance, privacy manifest data types, 1024×1024 RGB no-alpha icon, clean production build profile, and valid 8-persona catalog; **And** the epic plan, sprint state (including public repository visibility), architecture doc, and mobile README are synced in this change.

## Tasks

Run every command from the worktree root unless the command starts with `cd`. Never use `bun --cwd` (lesson 2026-05-05) and always filter by package name (`@pekulo/web`, `@pekulo/mobile`, lesson 2026-05-19). For mobile Jest, run `bun --filter='@pekulo/mobile' run test` or `cd apps/mobile && bunx jest ...` (never `bun test` in `apps/mobile`).

**T1 — Vendor `app-store-compliance` and `mobile-agent-testers` skills** [AC: AC-7]

- [x] **T1.1 — Copy vendored skills into `.agents/skills/`, link in `.claude/skills/`, and update `skills-lock.json`** [AC: AC-7]
  Ensure `.agents/skills/app-store-compliance/` (`SKILL.md`, `hooks/app-store-compliance-guard.sh`, `docs/`, `data/`, `references/`, `templates/`, `scripts/`), `.agents/skills/mobile-agent-testers/` (`SKILL.md`, `AGENT_BRIEF.md`, `personas.json`), symlinks `.claude/skills/app-store-compliance -> ../../.agents/skills/app-store-compliance` and `.claude/skills/mobile-agent-testers -> ../../.agents/skills/mobile-agent-testers`, and matching SHA-256 entries in `skills-lock.json` exist in this worktree.
  Run:
  ```bash
  test -x .agents/skills/app-store-compliance/hooks/app-store-compliance-guard.sh && \
  test -f .agents/skills/mobile-agent-testers/SKILL.md && \
  test -L .claude/skills/app-store-compliance && \
  test -L .claude/skills/mobile-agent-testers && \
  node -e 'const s=JSON.parse(require("fs").readFileSync("skills-lock.json","utf8")).skills; if(!s["app-store-compliance"]||!s["mobile-agent-testers"]) process.exit(1); console.log("SKILLS_OK");'
  ```
  Expected: `SKILLS_OK`, exit 0.
  Commit: `git add .agents/skills/app-store-compliance .agents/skills/mobile-agent-testers .claude/skills/app-store-compliance .claude/skills/mobile-agent-testers skills-lock.json && git commit -m "chore(#163): vendor app-store-compliance and mobile-agent-testers skills"`

**T2 — Public legal & account-deletion web routes + proxy bypass** [AC: AC-1]

- [x] **T2.1 (RED) — Create `apps/web/src/proxy.legal.test.ts`** [AC: AC-1]
  Create `apps/web/src/proxy.legal.test.ts`:
  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { NextRequest } from "next/server";

  const createServerClientMock = vi.fn();

  vi.mock("@supabase/ssr", () => ({
    createServerClient: (...args: unknown[]) => createServerClientMock(...args),
  }));

  import { proxy } from "./proxy";

  describe("proxy public legal routes (story 10-7, AC-1)", () => {
    it.each(["/privacy", "/terms", "/support", "/account-deletion"])(
      "allows anonymous GET %s with security headers and zero Supabase round-trip",
      async (pathname) => {
        createServerClientMock.mockClear();
        const request = new NextRequest(`https://pekulo.app${pathname}`);
        const response = await proxy(request);

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(createServerClientMock).not.toHaveBeenCalled();
      },
    );

    it("does not widen the bypass to sibling prefixes such as /privacy-internal", async () => {
      createServerClientMock.mockReset();
      createServerClientMock.mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      });
      const request = new NextRequest("https://pekulo.app/privacy-internal");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://pekulo.app/login");
      expect(createServerClientMock).toHaveBeenCalledTimes(1);
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test src/proxy.legal.test.ts`
  Expected (RED): `expected 307 to be 200` on `/privacy`, `/terms`, `/support`, `/account-deletion` (4 failed).
  Commit: none (committed with T2.2).

- [x] **T2.2 (GREEN) — Exempt exact `PUBLIC_LEGAL_PATHS` in `apps/web/src/proxy.ts`** [AC: AC-1]
  In `apps/web/src/proxy.ts`, replace:
  ```ts
  if (request.nextUrl.pathname === "/v1/logos") {
    return withSecurity(response);
  }
  ```
  with:
  ```ts
  const PUBLIC_LEGAL_PATHS = new Set([
    "/privacy",
    "/terms",
    "/support",
    "/account-deletion",
  ]);
  if (
    request.nextUrl.pathname === "/v1/logos" ||
    PUBLIC_LEGAL_PATHS.has(request.nextUrl.pathname)
  ) {
    return withSecurity(response);
  }
  ```
  Run: `bun --filter='@pekulo/web' run test src/proxy.legal.test.ts`
  Expected: `Tests  5 passed (5)`, exit 0.
  Commit: `git add apps/web/src/proxy.ts apps/web/src/proxy.legal.test.ts && git commit -m "feat(#163): allow public legal and account-deletion routes without auth"`

- [x] **T2.3 — Create public legal pages under `apps/web/src/app/(legal)/` + Vitest coverage** [AC: AC-1]
  Create `apps/web/src/app/(legal)/layout.tsx`:
  ```tsx
  import Link from "next/link";
  import type { ReactNode } from "react";
  import { Text, View } from "@pekulo/ui/client";

  const NAV_ITEMS = [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Accessibility" },
    { href: "/support", label: "Support" },
    { href: "/account-deletion", label: "Account Deletion" },
  ] as const;

  export default function LegalLayout({ children }: { children: ReactNode }) {
    return (
      <View
        minHeight="100vh"
        backgroundColor="$background"
        color="$color"
        paddingHorizontal="$6"
        paddingVertical="$8"
        alignItems="center"
      >
        <View width="100%" maxWidth={760} gap="$6">
          <View
            flexDirection="row"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
          >
            <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <Text fontSize="$h2" fontWeight="600" color="$color">
                Pekulo
              </Text>
            </Link>
            <View flexDirection="row" flexWrap="wrap" gap="$4">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ textDecoration: "underline", color: "inherit" }}
                >
                  <Text fontSize="$xs" color="$colorSecondary">
                    {item.label}
                  </Text>
                </Link>
              ))}
            </View>
          </View>
          <View
            backgroundColor="$backgroundCard"
            borderRadius="$xl"
            padding="$6"
            gap="$5"
          >
            {children}
          </View>
        </View>
      </View>
    );
  }
  ```

  Create `apps/web/src/app/(legal)/privacy/page.tsx`:
  ```tsx
  import type { Metadata } from "next";
  import { Text, View } from "@pekulo/ui/client";

  export const metadata: Metadata = {
    title: "Privacy Policy — Pekulo",
    description: "How Pekulo collects, processes, protects, and deletes personal and financial data.",
  };

  export default function PrivacyPage() {
    return (
      <View gap="$5">
        <View gap="$1">
          <Text fontSize="$h1" fontWeight="600" color="$color">
            Privacy Policy / Politique de confidentialité
          </Text>
          <Text fontSize="$xs" color="$colorTertiary">
            Last updated: 2026-11-25
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            1. Data Controller & Scope
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Pekulo is a goal-based personal finance tracker and planner. Personal data is processed
            strictly to deliver your account, net-worth tracking, and optional integrations under
            GDPR (EU 2016/679) and French CNIL guidance. Pekulo never sells user data and does not
            run cross-app advertising trackers.
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            2. Data Collected & Purpose
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Account identity (email address, password hash managed by Supabase Auth) and financial
            records you enter or connect (accounts, balances, transactions, holdings, real estate,
            compass targets, and monthly aggregates). Used solely for app functionality, linked to
            your account, and isolated via PostgreSQL Row Level Security.
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            3. Sub-processors & AI Categorisation
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Infrastructure and authentication: Supabase (encrypted at rest and TLS in transit).
            Optional bank aggregation (web, explicit consent): Bridge (ACPR-regulated AISP).
            Transaction categorisation runs locally (Apple FoundationModels or self-hosted Ollama)
            by default; third-party AI APIs are disabled by default and require explicit opt-in
            consent naming the provider, receiving only transaction label, amount, currency, and
            date (zero user identifiers or account numbers).
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            4. Retention & Your Rights (GDPR)
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Your data is retained while your account remains active. You may export all your data as
            JSON or permanently delete your account and every associated record at any time from
            Settings on web or mobile, or by following the instructions on /account-deletion.
            Contact: privacy@pekulo.app.
          </Text>
        </View>
      </View>
    );
  }
  ```

  Create `apps/web/src/app/(legal)/terms/page.tsx`:
  ```tsx
  import type { Metadata } from "next";
  import { Text, View } from "@pekulo/ui/client";

  export const metadata: Metadata = {
    title: "Terms of Service & Accessibility — Pekulo",
    description: "Pekulo terms of use, non-advisory disclaimer, and EAA Annex V accessibility notice.",
  };

  export default function TermsPage() {
    return (
      <View gap="$5">
        <View gap="$1">
          <Text fontSize="$h1" fontWeight="600" color="$color">
            Terms of Service & Accessibility
          </Text>
          <Text fontSize="$xs" color="$colorTertiary">
            Last updated: 2026-11-25
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            1. Nature of the Service
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Pekulo is a personal-finance tracking and goal-planning tool. Pekulo does not hold
            custody of funds or crypto assets, does not execute orders, and does not provide
            regulated investment, legal, or tax advice.
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            2. Accounts & Acceptable Use
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            You are responsible for safeguarding your credentials (minimum 12-character password).
            You may terminate your account and erase all stored data at any time via Settings or
            /account-deletion.
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            3. Accessibility Statement (European Accessibility Act — Directive (EU) 2019/882, Annex V)
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Pekulo is designed to conform with WCAG 2.1 / 2.2 Level AA and EN 301 549 Chapter 11
            for web and mobile interfaces: full keyboard and screen-reader (VoiceOver / TalkBack)
            navigation, light and dark themes with at least 4.5:1 body text contrast, Dynamic Type
            and system font scaling, and Reduced Motion support. Report any accessibility barrier to
            support@pekulo.app.
          </Text>
        </View>
      </View>
    );
  }
  ```

  Create `apps/web/src/app/(legal)/support/page.tsx`:
  ```tsx
  import type { Metadata } from "next";
  import Link from "next/link";
  import { Text, View } from "@pekulo/ui/client";

  export const metadata: Metadata = {
    title: "Support — Pekulo",
    description: "Contact Pekulo support and report issues.",
  };

  export default function SupportPage() {
    return (
      <View gap="$5">
        <View gap="$1">
          <Text fontSize="$h1" fontWeight="600" color="$color">
            Pekulo Support
          </Text>
          <Text fontSize="$xs" color="$colorTertiary">
            App Store & Google Play Support Center
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            Contact
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            For help with your account, data export, bug reports, or accessibility requests, email
            support@pekulo.app or open an issue on https://github.com/yabafre/pekulo/issues.
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            Account & Privacy Resources
          </Text>
          <View gap="$2">
            <Link href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>
              <Text fontSize="$bodySm" color="$color">
                Read the Privacy Policy (/privacy)
              </Text>
            </Link>
            <Link href="/account-deletion" style={{ textDecoration: "underline", color: "inherit" }}>
              <Text fontSize="$bodySm" color="$color">
                Delete your account and all data (/account-deletion)
              </Text>
            </Link>
          </View>
        </View>
      </View>
    );
  }
  ```

  Create `apps/web/src/app/(legal)/account-deletion/page.tsx`:
  ```tsx
  import type { Metadata } from "next";
  import Link from "next/link";
  import { Text, View } from "@pekulo/ui/client";

  export const metadata: Metadata = {
    title: "Account & Data Deletion — Pekulo",
    description: "How to permanently delete your Pekulo account and all associated financial data.",
  };

  export default function AccountDeletionPage() {
    return (
      <View gap="$5">
        <View gap="$1">
          <Text fontSize="$h1" fontWeight="600" color="$color">
            Account & Data Deletion
          </Text>
          <Text fontSize="$xs" color="$colorTertiary">
            GDPR Right to Erasure · Apple 5.1.1(v) · Google Play Data Safety
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            1. Delete Directly in the App (iOS, Android, Web)
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Open Pekulo → Settings (Paramètres) → Delete my account (Supprimer mon compte). Enter
            your account email address to confirm. Deletion runs immediately (within 60 seconds).
          </Text>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            2. Delete via Web After Uninstalling the Mobile App
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Sign in on the web dashboard, open Settings (/dashboard/parametres), and trigger
            permanent account deletion. If you cannot access your account, email privacy@pekulo.app
            from your registered email address and your account will be erased within 72 hours.
          </Text>
          <Link href="/login" style={{ textDecoration: "underline", color: "inherit" }}>
            <Text fontSize="$bodySm" color="$color">
              Sign in to manage or delete your account (/login)
            </Text>
          </Link>
        </View>

        <View gap="$2">
          <Text fontSize="$h3" fontWeight="600" color="$color">
            3. What Is Deleted
          </Text>
          <Text fontSize="$bodySm" color="$colorSecondary">
            Every user-scoped record is permanently erased in a single transaction across all 21
            database tables (compass, milestones, accounts, balance history, transactions, holdings,
            lots, real estate, mortgages, rentals, monthly tracking, preferences, AI opt-in &
            activity logs), any connected Bridge bank user is revoked and deleted first, and your
            Supabase Auth identity is permanently removed. No personal financial data is retained.
          </Text>
        </View>
      </View>
    );
  }
  ```

  Create `apps/web/src/app/(legal)/legal-pages.test.tsx`:
  ```tsx
  import { describe, expect, it } from "vitest";
  import { render, screen } from "@testing-library/react";

  import PrivacyPage from "./privacy/page";
  import TermsPage from "./terms/page";
  import SupportPage from "./support/page";
  import AccountDeletionPage from "./account-deletion/page";

  describe("Public legal & deletion pages (story 10-7, AC-1)", () => {
    it("renders /privacy with GDPR and sub-processor disclosures", () => {
      render(<PrivacyPage />);
      expect(screen.getByText(/Privacy Policy/i)).toBeTruthy();
      expect(screen.getByText(/Supabase/i)).toBeTruthy();
      expect(screen.getByText(/Bridge/i)).toBeTruthy();
    });

    it("renders /terms with EAA Annex V accessibility statement", () => {
      render(<TermsPage />);
      expect(screen.getByText(/Directive \(EU\) 2019\/882, Annex V/i)).toBeTruthy();
      expect(screen.getByText(/EN 301 549/i)).toBeTruthy();
    });

    it("renders /support with contact email and links", () => {
      render(<SupportPage />);
      expect(screen.getByText(/support@pekulo\.app/i)).toBeTruthy();
    });

    it("renders /account-deletion with in-app and web deletion instructions", () => {
      render(<AccountDeletionPage />);
      expect(screen.getByText(/Account & Data Deletion/i)).toBeTruthy();
      expect(screen.getByText(/all 21 database tables/i)).toBeTruthy();
    });
  });
  ```
  Run: `bun --filter='@pekulo/web' run test src/app/\(legal\)/legal-pages.test.tsx && bun --filter='@pekulo/web' run lint`
  Expected: `Tests  4 passed (4)` and lint exit 0 (zero `no-tailwind-outside-ui` violations).
  Commit: `git add "apps/web/src/app/(legal)" && git commit -m "feat(#163): add public privacy, terms, support, and account-deletion web pages"`

**T3 — Canonical RGB no-alpha mobile assets, `PrivacyInfo`, and Export Compliance in `app.json`** [AC: AC-3, AC-8]

- [x] **T3.1 — Generate canonical mobile assets (`icon.png` 1024×1024 RGB no-alpha, `adaptive-icon.png`, `splash-icon.png`)** [AC: AC-3]
  Run from repository root using `apps/web`'s `sharp` dependency and canonical source `apps/web/public/icons/_source/pekulo-icon-1024.png`:
  ```bash
  bun -e '
  const sharp = require("./apps/web/node_modules/sharp");
  const fs = require("node:fs");
  fs.mkdirSync("apps/mobile/assets", { recursive: true });
  const src = "apps/web/public/icons/_source/pekulo-icon-1024.png";
  (async () => {
    const { data } = await sharp(src).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bg = { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 };
    await sharp(src).resize(1024, 1024, { fit: "cover" }).flatten({ background: bg }).removeAlpha().png().toFile("apps/mobile/assets/icon.png");
    const inner = Math.round(1024 * 0.66);
    const glyph = await sharp(src).resize(inner, inner, { fit: "contain" }).png().toBuffer();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 0 } } }).composite([{ input: glyph, gravity: "centre" }]).png().toFile("apps/mobile/assets/adaptive-icon.png");
    await sharp(src).resize(512, 512, { fit: "contain" }).png().toFile("apps/mobile/assets/splash-icon.png");
    const meta = await sharp("apps/mobile/assets/icon.png").metadata();
    console.log("ICON_META:", meta.width, meta.height, "hasAlpha=" + meta.hasAlpha);
    if (meta.width !== 1024 || meta.height !== 1024 || meta.hasAlpha) process.exit(1);
  })();
  '
  ```
  Expected: `ICON_META: 1024 1024 hasAlpha=false`, exit 0.

- [x] **T3.2 — Update `apps/mobile/app.json` and `apps/mobile/eas.json`** [AC: AC-3, AC-4]
  Replace `apps/mobile/app.json` completely with:
  ```json
  {
    "expo": {
      "name": "Pekulo",
      "slug": "pekulo",
      "version": "0.1.0",
      "scheme": "pekulo",
      "orientation": "portrait",
      "userInterfaceStyle": "automatic",
      "backgroundColor": "#000000",
      "icon": "./assets/icon.png",
      "ios": {
        "supportsTablet": true,
        "bundleIdentifier": "app.pekulo.mobile",
        "config": {
          "usesNonExemptEncryption": false
        },
        "privacyManifests": {
          "NSPrivacyTracking": false,
          "NSPrivacyTrackingDomains": [],
          "NSPrivacyAccessedAPITypes": [
            {
              "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
              "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
            },
            {
              "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
              "NSPrivacyAccessedAPITypeReasons": ["C617.1"]
            },
            {
              "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
              "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
            }
          ],
          "NSPrivacyCollectedDataTypes": [
            {
              "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress",
              "NSPrivacyCollectedDataTypeLinked": true,
              "NSPrivacyCollectedDataTypeTracking": false,
              "NSPrivacyCollectedDataTypePurposes": [
                "NSPrivacyCollectedDataTypePurposeAppFunctionality"
              ]
            },
            {
              "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeOtherFinancialInfo",
              "NSPrivacyCollectedDataTypeLinked": true,
              "NSPrivacyCollectedDataTypeTracking": false,
              "NSPrivacyCollectedDataTypePurposes": [
                "NSPrivacyCollectedDataTypePurposeAppFunctionality"
              ]
            }
          ]
        }
      },
      "android": {
        "package": "app.pekulo.mobile",
        "softwareKeyboardLayoutMode": "resize",
        "adaptiveIcon": {
          "foregroundImage": "./assets/adaptive-icon.png",
          "backgroundColor": "#000000"
        }
      },
      "plugins": [
        "expo-router",
        "expo-dev-client",
        "expo-font",
        "expo-secure-store",
        [
          "expo-splash-screen",
          {
            "image": "./assets/splash-icon.png",
            "backgroundColor": "#000000",
            "dark": {
              "image": "./assets/splash-icon.png",
              "backgroundColor": "#000000"
            }
          }
        ]
      ],
      "experiments": {
        "typedRoutes": true,
        "reactCompiler": true
      },
      "extra": {
        "router": {
          "asyncRoutes": {
            "web": true
          }
        },
        "eas": {
          "projectId": "5ada2dbf-0974-4ba6-9807-fd632b3299ca"
        }
      },
      "owner": "skinx"
    }
  }
  ```
  In `apps/mobile/eas.json`, add `"EXPO_PUBLIC_ALLOW_PREVIEW": "1"` to `build["e2e-test"].env`:
  ```json
      "env": {
        "EXPO_PUBLIC_ALLOW_PREVIEW": "1",
        "EXPO_PUBLIC_DS_GALLERY": "1",
        "DATABASE_URL": "postgresql://stub:stub@localhost:5432/stub"
      }
  ```
  Run: `bunx oxfmt --check apps/mobile/app.json apps/mobile/eas.json && bun --filter='@pekulo/mobile' run typecheck`
  Expected: exit 0.
  Commit: `git add apps/mobile/assets apps/mobile/app.json apps/mobile/eas.json && git commit -m "feat(#163): add canonical RGB app icons, iOS privacy manifest, and export compliance"`

**T4 — Keychain backup exclusion, release fail-fast guard, and mobile legal helper** [AC: AC-2, AC-4]

- [x] **T4.1 (RED) — Create `apps/mobile/__tests__/legal-and-security.test.ts`** [AC: AC-2, AC-4]
  Create `apps/mobile/__tests__/legal-and-security.test.ts`:
  ```ts
  import { Linking } from "react-native";

  import { assertReleaseSupabaseConfigured } from "../lib/auth/auth-context";
  import { getLegalUrl, openLegalUrl } from "../lib/legal";
  import { createChunkedSecureStorage, SECURE_STORE_OPTIONS } from "../lib/supabase/secure-storage";

  describe("legal links & mobile security hardening (story 10-7, AC-2, AC-4)", () => {
    it("resolves legal URLs against EXPO_PUBLIC_WEB_BASE_URL with https://pekulo.app default", () => {
      expect(getLegalUrl("/privacy", {})).toBe("https://pekulo.app/privacy");
      expect(getLegalUrl("/terms", { EXPO_PUBLIC_WEB_BASE_URL: "https://staging.pekulo.app/" })).toBe(
        "https://staging.pekulo.app/terms",
      );
      expect(getLegalUrl("/support", { EXPO_PUBLIC_WEB_BASE_URL: "http://insecure.example" })).toBe(
        "https://pekulo.app/support",
      );
    });

    it("opens legal URLs via Linking.openURL", async () => {
      const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      await openLegalUrl("/privacy");
      expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
      openSpy.mockRestore();
    });

    it("writes SecureStore items with AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY", async () => {
      const store = new Map<string, string>();
      const setItemAsync = jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      });
      const storage = createChunkedSecureStorage({
        getItemAsync: async (key: string) => store.get(key) ?? null,
        setItemAsync,
        deleteItemAsync: async (key: string) => {
          store.delete(key);
        },
      });

      await storage.setItem("pekulo-mobile-auth", "short-token");
      expect(setItemAsync).toHaveBeenCalledWith(
        "pekulo-mobile-auth",
        "short-token",
        SECURE_STORE_OPTIONS,
      );
    });

    it("throws in release builds when Supabase is unconfigured unless EXPO_PUBLIC_ALLOW_PREVIEW=1", () => {
      expect(() => assertReleaseSupabaseConfigured(false, {}, false)).toThrow(
        /EXPO_PUBLIC_SUPABASE_URL/i,
      );
      expect(() =>
        assertReleaseSupabaseConfigured(false, { EXPO_PUBLIC_ALLOW_PREVIEW: "1" }, false),
      ).not.toThrow();
      expect(() => assertReleaseSupabaseConfigured(true, {}, false)).not.toThrow();
      expect(() => assertReleaseSupabaseConfigured(false, {}, true)).not.toThrow();
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest __tests__/legal-and-security.test.ts`
  Expected (RED): `Cannot find module '../lib/legal'`, `Test Suites: 1 failed`.
  Commit: none (committed with T4.2).

- [x] **T4.2 (GREEN) — Create `apps/mobile/lib/legal.ts`, harden `secure-storage.ts`, `auth-context.tsx`, and `jest.setup.ts`** [AC: AC-2, AC-4]
  Create `apps/mobile/lib/legal.ts`:
  ```ts
  // apps/mobile/lib/legal.ts
  // Canonical public web URLs for App Store & Google Play compliance (story 10-7, AC-2).
  import { Linking } from "react-native";

  export type LegalPath = "/privacy" | "/terms" | "/support" | "/account-deletion";

  const DEFAULT_WEB_BASE_URL = "https://pekulo.app";

  export function getLegalUrl(
    path: LegalPath,
    env?: Record<string, string | undefined>,
  ): string {
    const raw = (env ? env.EXPO_PUBLIC_WEB_BASE_URL : process.env.EXPO_PUBLIC_WEB_BASE_URL)?.trim();
    const base = raw && /^https:\/\//i.test(raw) ? raw.replace(/\/+$/, "") : DEFAULT_WEB_BASE_URL;
    return `${base}${path}`;
  }

  export async function openLegalUrl(path: LegalPath): Promise<void> {
    await Linking.openURL(getLegalUrl(path));
  }
  ```

  In `apps/mobile/jest.setup.ts`, update the `expo-secure-store` mock (lines 29-42) to expose `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6`:
  ```ts
  jest.mock("expo-secure-store", () => {
    const store = new Map<string, string>();
    return {
      __esModule: true,
      __store: store,
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
      getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
      setItemAsync: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      deleteItemAsync: jest.fn(async (key: string) => {
        store.delete(key);
      }),
    };
  });
  ```

  In `apps/mobile/lib/supabase/secure-storage.ts`, export `SECURE_STORE_OPTIONS`, widen `SecureStoreDriver.setItemAsync` to accept optional `options`, and pass `SECURE_STORE_OPTIONS` on every `setItemAsync` call:
  ```ts
  export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };

  export interface SecureStoreDriver {
    getItemAsync: (key: string) => Promise<string | null>;
    setItemAsync: (
      key: string,
      value: string,
      options?: SecureStore.SecureStoreOptions,
    ) => Promise<void>;
    deleteItemAsync: (key: string) => Promise<void>;
  }
  ```
  and in `setItem`:
  ```ts
      if (chunks.length <= 1) {
        await driver.setItemAsync(key, value, SECURE_STORE_OPTIONS);
        await deleteChunks(key, previous);
        return;
      }

      const id = newGenerationId();
      await Promise.all(
        chunks.map((chunk, idx) =>
          driver.setItemAsync(chunkKey(key, idx, id), chunk, SECURE_STORE_OPTIONS),
        ),
      );
      const manifest: ChunkManifest = { __chunked: true, count: chunks.length, id };
      await driver.setItemAsync(key, JSON.stringify(manifest), SECURE_STORE_OPTIONS);
      await deleteChunks(key, previous);
  ```

  In `apps/mobile/lib/auth/auth-context.tsx`, export `assertReleaseSupabaseConfigured` and invoke it in `AuthProvider` when `requireAuth === undefined && initialSession === null`:
  ```ts
  export function assertReleaseSupabaseConfigured(
    configured: boolean,
    env?: Record<string, string | undefined>,
    isDev: boolean = __DEV__,
  ): void {
    if (isDev || configured) return;
    const allowPreview = (
      env ? env.EXPO_PUBLIC_ALLOW_PREVIEW : process.env.EXPO_PUBLIC_ALLOW_PREVIEW
    )?.trim();
    if (allowPreview === "1") return;
    throw new Error(
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in release builds",
    );
  }
  ```
  Inside `AuthProvider`, right after `const configured = isSupabaseConfigured();`:
  ```ts
  if (requireAuth === undefined && initialSession === null) {
    assertReleaseSupabaseConfigured(configured);
  }
  ```
  Run: `cd apps/mobile && bunx jest __tests__/legal-and-security.test.ts __tests__/auth-and-orpc.test.tsx`
  Expected: `Test Suites: 2 passed, 2 total`, exit 0.
  Commit: `git add apps/mobile/lib/legal.ts apps/mobile/lib/supabase/secure-storage.ts apps/mobile/lib/auth/auth-context.tsx apps/mobile/jest.setup.ts apps/mobile/__tests__/legal-and-security.test.ts && git commit -m "feat(#163): add legal URL helper, Keychain backup exclusion, and release Supabase guard"`

**T5 — Apple 5.1.2(i) third-party AI consent modal, mobile EU AI Act notice, and in-app legal links** [AC: AC-2, AC-5]

- [x] **T5.1 — Add FR/EN i18n keys for legal links, AI consent modal, and AI transparency notice** [AC: AC-2, AC-5]
  Update `apps/mobile/lib/i18n/messages/auth.ts`: add `privacyPolicy` and `terms` to `fr` and `en`:
  - `fr`: `privacyPolicy: "Politique de confidentialité"`, `terms: "Conditions d’utilisation"`
  - `en`: `privacyPolicy: "Privacy Policy"`, `terms: "Terms of Service"`

  Update `apps/mobile/lib/i18n/messages/settings.ts`:
  - Under `ai` (`fr`): add `intro`, `consentTitle`, `consentMessage`, `consentConfirm`, `defaultProvider`:
    - `intro: "Pekulo catégorise vos transactions automatiquement sur votre appareil ou notre serveur privé. Aucune donnée ne quitte ce périmètre sans votre accord explicite."`
    - `consentTitle: "Activer les modèles IA tiers ?"`
    - `consentMessage: "Vos libellés de transaction, montants, devises et dates (sans identifiant personnel ni numéro de compte) seront envoyés à {provider} pour suggérer des catégories."`
    - `consentConfirm: "Autoriser"`
    - `defaultProvider: "le fournisseur IA configuré"`
  - Under `ai` (`en`):
    - `intro: "Pekulo categorises your transactions automatically on your device or private server. No data leaves this perimeter without your explicit consent."`
    - `consentTitle: "Enable third-party AI models?"`
    - `consentMessage: "Transaction labels, amounts, currencies, and dates (zero personal identifiers or account numbers) will be sent to {provider} to suggest categories."`
    - `consentConfirm: "Allow"`
    - `defaultProvider: "the configured AI provider"`
  - Add top-level `legal` section (`fr` / `en`):
    - `fr`: `{ title: "Mentions légales", aria: "Mentions légales et support", privacy: "Politique de confidentialité", terms: "Conditions d’utilisation & accessibilité", support: "Assistance" }`
    - `en`: `{ title: "Legal", aria: "Legal and support links", privacy: "Privacy Policy", terms: "Terms of Service & Accessibility", support: "Support" }`

  Update `apps/mobile/lib/i18n/messages/transactions.ts`:
  - Under `suggestions` (`fr`): add `aiNoticeBody: "Pekulo utilise une IA pour suggérer les catégories de vos transactions. Vous pouvez modifier n’importe quelle catégorie à tout moment."`, `aiNoticeDismiss: "Compris"`, `aiNoticeAria: "Notice de transparence IA"`
  - Under `suggestions` (`en`): add `aiNoticeBody: "Pekulo uses AI to suggest transaction categories. You can review and change any category at any time."`, `aiNoticeDismiss: "Got it"`, `aiNoticeAria: "AI transparency notice"`

  Run: `cd apps/mobile && bunx jest __tests__/i18n-cap.test.tsx __tests__/i18n-transactions-monthly.test.tsx __tests__/i18n-assets-settings.test.tsx`
  Expected: `Test Suites: 3 passed, 3 total`, exit 0.
  Commit: `git add apps/mobile/lib/i18n/messages/auth.ts apps/mobile/lib/i18n/messages/settings.ts apps/mobile/lib/i18n/messages/transactions.ts && git commit -m "feat(#163): add FR/EN copy for legal links, AI consent modal, and AI notice"`

- [x] **T5.2 (RED) — Create `apps/mobile/__tests__/ai-consent-and-notice.test.tsx`** [AC: AC-2, AC-5]
  Create `apps/mobile/__tests__/ai-consent-and-notice.test.tsx`:
  ```tsx
  import { PekuloRootProvider } from "@pekulo/ui";
  import type { Session } from "@supabase/supabase-js";
  import { QueryClientProvider } from "@tanstack/react-query";
  import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
  import type { ReactNode } from "react";
  import { Alert, Linking } from "react-native";

  import LoginScreen from "../app/login";
  import ParametresScreen from "../app/parametres";
  import { AiTransparencyNotice } from "../components/ai-transparency-notice";
  import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
  import { compassClient, llmClient, settingsClient } from "../lib/orpc/modules";

  jest.mock("expo-router", () => {
    const actual = jest.requireActual("expo-router");
    return {
      ...actual,
      useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
    };
  });

  jest.mock("expo-router/stack", () => {
    const React = require("react") as typeof import("react");
    function MockStack({ children }: { children?: React.ReactNode }) {
      return React.createElement(React.Fragment, null, children);
    }
    MockStack.Screen = () => null;
    MockStack.Toolbar = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children);
    MockStack.Toolbar.Button = () => null;
    return { __esModule: true, default: MockStack };
  });

  jest.mock("../lib/orpc/modules", () => {
    const actual = jest.requireActual("../lib/orpc/modules");
    return {
      ...actual,
      compassClient: { getCompass: jest.fn() },
      llmClient: {
        getOptIn: jest.fn(),
        setOptIn: jest.fn(),
        getAiNotice: jest.fn(),
        markAiNotice: jest.fn(),
      },
      settingsClient: { get: jest.fn(), updateTheme: jest.fn(), updateLang: jest.fn(), deleteAccount: jest.fn() },
    };
  });

  const SESSION: Session = {
    access_token: "jwt",
    refresh_token: "r",
    expires_in: 3600,
    expires_at: 1999999999,
    token_type: "bearer",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "alex@pekulo.app",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-05-03T00:00:00Z",
    },
  };

  async function renderLive(ui: ReactNode) {
    const queryClient = createMobileQueryClient();
    return await render(
      <QueryClientProvider client={queryClient}>
        <PekuloRootProvider theme="pekulo-light">
          <AuthProvider initialSession={SESSION} requireAuth={false}>
            {ui}
          </AuthProvider>
        </PekuloRootProvider>
      </QueryClientProvider>,
    );
  }

  describe("Apple 5.1.2(i) AI consent, EU AI Act notice, and legal links (story 10-7, AC-2, AC-5)", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.restoreAllMocks();
      (compassClient.getCompass as jest.Mock).mockResolvedValue({ objectif: 800000, horizonYears: 30 });
      (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
      (llmClient.getAiNotice as jest.Mock).mockResolvedValue({ seen: false });
      (llmClient.markAiNotice as jest.Mock).mockResolvedValue({ seen: true });
      (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "fr" });
    });

    it("shows explicit consent modal naming the provider and cancels without calling setOptIn", async () => {
      const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
      await renderLive(<ParametresScreen />);
      await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());

      await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
      expect(alertSpy).toHaveBeenCalledWith(
        "Activer les modèles IA tiers ?",
        expect.stringContaining("libellés de transaction"),
        expect.any(Array),
      );
      expect(llmClient.setOptIn).not.toHaveBeenCalled();
    });

    it("renders AI transparency notice when unseen, marks it seen once, and hides on dismiss", async () => {
      await renderLive(<AiTransparencyNotice />);
      expect(await screen.findByTestId("ai-transparency-notice")).toBeTruthy();
      await waitFor(() => expect(llmClient.markAiNotice).toHaveBeenCalledTimes(1));

      await fireEvent.press(screen.getByTestId("ai-transparency-notice-dismiss"));
      expect(screen.queryByTestId("ai-transparency-notice")).toBeNull();
    });

    it("opens /privacy from both Login and Paramètres screens", async () => {
      const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      await renderLive(<LoginScreen />);
      await fireEvent.press(screen.getByTestId("login-privacy-link"));
      expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest __tests__/ai-consent-and-notice.test.tsx`
  Expected (RED): `Cannot find module '../components/ai-transparency-notice'`, `Test Suites: 1 failed`.
  Commit: none (committed with T5.3).

- [x] **T5.3 (GREEN) — Implement `useAiNotice`, `AiTransparencyNotice`, consent modal in `parametres.tsx`, legal links in `login.tsx` & `parametres.tsx`, and mount notice in `transactions/index.tsx`** [AC: AC-2, AC-5]
  1. In `apps/mobile/lib/hooks/use-mobile-mutations.ts`, export `useAiNotice()` and update `useLlmOptIn()` so enabling third-party AI invalidates `aiNotice` cache:
  ```ts
  export function useAiNotice() {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = [...mobileQueryKeys.llm(), "ai-notice", isAuthenticated];
    const query = useQuery({
      queryKey,
      enabled: isAuthenticated,
      queryFn: async () => await llmClient.getAiNotice(),
    });
    const mark = useMutation({
      mutationFn: async () => await llmClient.markAiNotice(),
      onSuccess: () => {
        queryClient.setQueryData(queryKey, { seen: true });
      },
    });
    return {
      seen: query.data?.seen ?? true,
      isLoading: query.isLoading,
      markSeen: mark.mutate,
      isMarking: mark.isPending,
    };
  }
  ```
  And in `useLlmOptIn`'s `onSuccess`:
  ```ts
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKey, updated);
      await queryClient.invalidateQueries({
        queryKey: [...mobileQueryKeys.llm(), "ai-notice"],
      });
    },
  ```

  2. Create `apps/mobile/components/ai-transparency-notice.tsx`:
  ```tsx
  // apps/mobile/components/ai-transparency-notice.tsx
  // Mobile port of story 11-5 (EU AI Act Art. 50 / DR-12): displays once when
  // AI suggestions appear and `llmClient.getAiNotice()` returns `seen: false`,
  // marks seen server-side, and latches visible until explicitly dismissed.
  import { PekuloButton } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { Sparkles } from "lucide-react-native";
  import { useEffect, useRef, useState } from "react";
  import { useTheme } from "tamagui";

  import { useAuth } from "../lib/auth/auth-context";
  import { useAiNotice } from "../lib/hooks/use-mobile-mutations";
  import { useI18n } from "../lib/i18n";

  export function AiTransparencyNotice() {
    const { isAuthenticated } = useAuth();
    const { seen, isLoading, markSeen, isMarking } = useAiNotice();
    const theme = useTheme();
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    const suppressedRef = useRef(false);
    const markedRef = useRef(false);

    const unseen = isAuthenticated && !isLoading && seen === false;

    useEffect(() => {
      if (!unseen) {
        if (seen === true) suppressedRef.current = false;
        markedRef.current = false;
        return;
      }
      if (!suppressedRef.current) {
        if (!visible) setVisible(true);
        if (!markedRef.current && !isMarking) {
          markedRef.current = true;
          markSeen();
        }
      }
    }, [unseen, seen, visible, isMarking, markSeen]);

    if (!visible) return null;

    return (
      <View
        testID="ai-transparency-notice"
        accessibilityLabel={t("transactions.suggestions.aiNoticeAria")}
        backgroundColor="$backgroundMuted"
        borderRadius="$lg"
        padding="$3"
        gap="$3"
      >
        <View flexDirection="row" alignItems="flex-start" gap="$2">
          <Sparkles size={16} color={theme.colorSecondary.val} />
          <Text color="$colorSecondary" fontSize="$xs" flex={1}>
            {t("transactions.suggestions.aiNoticeBody")}
          </Text>
        </View>
        <View alignItems="flex-end">
          <PekuloButton
            variant="ghost"
            size="sm"
            testID="ai-transparency-notice-dismiss"
            onPress={() => {
              setVisible(false);
              suppressedRef.current = true;
            }}
          >
            {t("transactions.suggestions.aiNoticeDismiss")}
          </PekuloButton>
        </View>
      </View>
    );
  }
  ```

  3. In `apps/mobile/app/(tabs)/transactions/index.tsx`, import `{ AiTransparencyNotice }` from `../../../components/ai-transparency-notice` and replace:
     ```tsx
                {viewData.pendingSuggestions.map((item) => (
     ```
     with:
     ```tsx
                <AiTransparencyNotice />
                {viewData.pendingSuggestions.map((item) => (
     ```

  4. In `apps/mobile/app/parametres.tsx`:
     - Import `openLegalUrl` from `../lib/legal`.
     - Replace `handleThirdPartyChange(next: boolean)` with:
       ```tsx
       function handleThirdPartyChange(next: boolean) {
         if (!next) {
           void run(() => llm.setThirdParty(false), t("settings.ai.disabled"));
           return;
         }
         const provider =
           process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME?.trim() ||
           t("settings.ai.defaultProvider");
         Alert.alert(
           t("settings.ai.consentTitle"),
           t("settings.ai.consentMessage", { provider }),
           [
             { text: t("common.actions.cancel"), style: "cancel" },
             {
               text: t("settings.ai.consentConfirm"),
               onPress: () => {
                 void run(() => llm.setThirdParty(true), t("settings.ai.enabled"));
               },
             },
           ],
         );
       }
       ```
     - Add the intro transparency paragraph `<Text color="$colorSecondary" fontSize="$xs">{t("settings.ai.intro")}</Text>` above `<SwitchField>` in the AI section.
     - Add a `Legal` `<Section title={t("settings.legal.title")} ariaLabel={t("settings.legal.aria")}>` with 44pt Pressable rows calling `void openLegalUrl("/privacy")`, `void openLegalUrl("/terms")`, `void openLegalUrl("/support")` (with `testID="settings-privacy-link"`, `"settings-terms-link"`, `"settings-support-link"`).

  5. In `apps/mobile/app/login.tsx`, import `openLegalUrl` and add a centered footer row with `testID="login-privacy-link"` (`t("auth.privacyPolicy")`) and `testID="login-terms-link"` (`t("auth.terms")`).

  6. Update `apps/mobile/__tests__/settings-interactions.test.tsx` (`toggles the third-party AI opt-in from Paramètres`) so it confirms the Apple 5.1.2(i) `Alert.alert` button before asserting `llmClient.setOptIn` was called with `{ thirdParty: true }`.

  Run: `cd apps/mobile && bunx jest __tests__/ai-consent-and-notice.test.tsx __tests__/settings-interactions.test.tsx`
  Expected: `Test Suites: 2 passed, 2 total`, exit 0.
  Commit: `git add apps/mobile/components/ai-transparency-notice.tsx apps/mobile/lib/hooks/use-mobile-mutations.ts "apps/mobile/app/(tabs)/transactions/index.tsx" apps/mobile/app/parametres.tsx apps/mobile/app/login.tsx apps/mobile/__tests__/ai-consent-and-notice.test.tsx apps/mobile/__tests__/settings-interactions.test.tsx && git commit -m "feat(#163): add Apple 5.1.2(i) AI consent modal, mobile AI notice, and in-app legal links"`

**T6 — Tactile haptics (`expo-haptics`) & release readiness kit** [AC: AC-6]

- [x] **T6.1 — Install `expo-haptics`, add `apps/mobile/lib/haptics.ts`, wire into `sheet.tsx` & `actions.ts`, and mock in `jest.setup.ts`** [AC: AC-6]
  Install `expo-haptics`:
  ```bash
  cd apps/mobile && bunx expo install expo-haptics
  ```
  Add to `apps/mobile/jest.setup.ts`:
  ```ts
  jest.mock("expo-haptics", () => ({
    NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
    ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    impactAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
  }));
  ```
  Create `apps/mobile/lib/haptics.ts`:
  ```ts
  // apps/mobile/lib/haptics.ts
  // Best-effort tactile feedback helpers (Apple HIG Accessibility). Never throws
  // on simulators, web, or devices without a haptic engine.
  import * as Haptics from "expo-haptics";

  export function hapticSuccess(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  export function hapticError(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }

  export function hapticWarning(): void {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }

  export function hapticSelection(): void {
    void Haptics.selectionAsync().catch(() => {});
  }
  ```
  Wire `hapticSuccess()` on success and `hapticError()` on error inside `useMutationRunner` (`apps/mobile/components/form/sheet.tsx`), and `hapticWarning()` inside `confirmDestructive` (`apps/mobile/lib/actions.ts`).

- [x] **T6.2 — Add `apps/mobile/.app-review-readiness.json` and `apps/mobile/docs/REVIEW-NOTES.md`** [AC: AC-6]
  Copy `.agents/skills/app-store-compliance/templates/app-review-readiness.json` to `apps/mobile/.app-review-readiness.json` and populate with Pekulo's real status (`open` for manual pre-submission checks: demo account, live prod backend, Apple/Google Organization D-U-N-S, DSA trader status, iPad 13" screenshots, Universal Links deferred until Apple Team ID is assigned).
  Create `apps/mobile/docs/REVIEW-NOTES.md` in English from `.agents/skills/app-store-compliance/templates/REVIEW-NOTES-TEMPLATE.md`, documenting:
  - Demo account credentials slot (injected before submission, no 2FA barrier, pre-populated net worth)
  - Step-by-step tap path across all 5 tabs, form sheets, AI opt-in consent modal, and in-app account deletion
  - Positioning note: personal finance tracker/planner only (no brokerage, no custody, no crypto trading, no investment advice; Bridge open banking is web-only)
  - Encryption note: standard OS TLS/Keychain only (`ITSAppUsesNonExemptEncryption: false`).

  Run: `cd apps/mobile && bunx jest __tests__/mutations.test.tsx __tests__/sheets-transactions-cap.test.tsx`
  Expected: `Test Suites: 2 passed, 2 total`, exit 0.
  Commit: `git add apps/mobile/package.json bun.lock apps/mobile/jest.setup.ts apps/mobile/lib/haptics.ts apps/mobile/components/form/sheet.tsx apps/mobile/lib/actions.ts apps/mobile/.app-review-readiness.json apps/mobile/docs/REVIEW-NOTES.md && git commit -m "feat(#163): add expo-haptics feedback and store review readiness docs"`

**T7 — Mobile Agent Testers kit (`apps/mobile/.agent-testers/`)** [AC: AC-7]

- [x] **T7.1 — Add English `personas.json`, `AGENT_BRIEF.md`, and `README.md` under `apps/mobile/.agent-testers/`** [AC: AC-7]
  Write `apps/mobile/.agent-testers/personas.json` (8 personas: `clara`, `sven_fr`, `jonas_ipad`, `noah_pro`, `anna_fr`, `grace_a11y`, `malik_dark`, `lucia_tab`), `apps/mobile/.agent-testers/AGENT_BRIEF.md` (Pekulo-tailored mission covering preview/live mode, all 5 tabs, form sheets, Settings theme/language/AI/legal/deletion checks, Dynamic Type/200% font, iPad/tablet, Android Material Symbols, and accessibility checks), and `apps/mobile/.agent-testers/README.md` documenting:
  - `yabafre/pekulo` is **PUBLIC** → free GitHub Actions Linux & macOS runners (5 concurrent macOS jobs on Free plan), zero ToS issue; encryption via `results_public.pem` is mandatory because public repo logs are public.
  - Recommend batches of **4–6 personas** to stay within Claude Pro/Max 5-hour quota.
  - Exact custom Bun 1.3.14 monorepo `ios_build` / `ios_app_path` and `android_build` / `apk_path` workflow inputs (`app_dir=.`, `source_repo=yabafre/pekulo`, `app_id=app.pekulo.mobile`) because upstream's auto Expo builder runs `npm ci` which fails on `workspace:*` dependencies.
  - Security rule: run `./setup.sh` and `bash scripts/collect.sh <run-id>` exclusively in the developer's local terminal.

  Run: `node -e 'const p=JSON.parse(require("fs").readFileSync("apps/mobile/.agent-testers/personas.json","utf8")); if(p.length!==8) process.exit(1); console.log("PERSONAS_OK", p.map(x=>x.id).join(","));'`
  Expected: `PERSONAS_OK clara,sven_fr,jonas_ipad,noah_pro,anna_fr,grace_a11y,malik_dark,lucia_tab`, exit 0.
  Commit: `git add apps/mobile/.agent-testers && git commit -m "feat(#163): add Pekulo Mobile Agent Testers personas, brief, and setup guide"`

**T8 — Class-killer compliance meta-test, full verification & doc sync** [AC: AC-8]

- [x] **T8.1 — Add `apps/mobile/__tests__/store-compliance.test.ts`** [AC: AC-8]
  Create `apps/mobile/__tests__/store-compliance.test.ts`:
  ```ts
  // apps/mobile/__tests__/store-compliance.test.ts
  // Story 10-7 AC-8 — class-killer meta-test asserting App Store & Google Play
  // invariants mechanically so pre-submission regressions fail CI immediately.
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");

  const MOBILE_ROOT = path.resolve(__dirname, "..");

  /** PNG IHDR color-type byte at offset 25: 2 = RGB (no alpha), 4/6 = has alpha. */
  function pngColorType(filePath: string): { width: number; height: number; colorType: number } {
    const buf = fs.readFileSync(filePath);
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      colorType: buf.readUInt8(25),
    };
  }

  describe("store compliance invariants (story 10-7, AC-3, AC-7, AC-8)", () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "app.json"), "utf8"));
    const easJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, "eas.json"), "utf8"));

    it("declares iOS export compliance (usesNonExemptEncryption: false)", () => {
      expect(appJson.expo.ios.config.usesNonExemptEncryption).toBe(false);
    });

    it("declares iOS Privacy Manifest with Email and Financial data types and tracking disabled", () => {
      const manifest = appJson.expo.ios.privacyManifests;
      expect(manifest.NSPrivacyTracking).toBe(false);
      const types = manifest.NSPrivacyCollectedDataTypes.map(
        (d: { NSPrivacyCollectedDataType: string }) => d.NSPrivacyCollectedDataType,
      );
      expect(types).toContain("NSPrivacyCollectedDataTypeEmailAddress");
      expect(types).toContain("NSPrivacyCollectedDataTypeOtherFinancialInfo");
    });

    it("ships a 1024x1024 RGB icon with no alpha channel (prevents ITMS-90717)", () => {
      expect(appJson.expo.icon).toBe("./assets/icon.png");
      const { width, height, colorType } = pngColorType(path.join(MOBILE_ROOT, "assets/icon.png"));
      expect(width).toBe(1024);
      expect(height).toBe(1024);
      expect(colorType).toBe(2);
    });

    it("keeps production EAS profile free of localhost/stub overrides", () => {
      const prodEnv = JSON.stringify(easJson.build.production.env ?? {});
      expect(prodEnv).not.toMatch(/localhost|127\.0\.0\.1|stub/i);
      expect(easJson.build["e2e-test"].env.EXPO_PUBLIC_ALLOW_PREVIEW).toBe("1");
    });

    it("ships valid Mobile Agent Testers personas covering iOS and Android", () => {
      const personas = JSON.parse(
        fs.readFileSync(path.join(MOBILE_ROOT, ".agent-testers/personas.json"), "utf8"),
      );
      expect(personas.filter((p: { platform: string }) => p.platform === "ios").length).toBe(4);
      expect(personas.filter((p: { platform: string }) => p.platform === "android").length).toBe(4);
    });
  });
  ```
  Run: `cd apps/mobile && bunx jest __tests__/store-compliance.test.ts`
  Expected: `Tests: 5 passed, 5 total`, exit 0.

- [x] **T8.2 — Run full quality gates, compliance guard, and doc sync** [AC: AC-8]
  Sync `docs/architecture.md` (document public `(legal)` routes, mobile privacy/haptics/AI-notice posture, and `.agent-testers` kit) and `apps/mobile/README.md` (add Pre-Submission Compliance & Mobile Agent Testers section).
  Run full verification:
  ```bash
  bun run typecheck && \
  bun run lint && \
  bun run format:check && \
  bun --filter='@pekulo/web' run test && \
  bun --filter='@pekulo/mobile' run test && \
  bash .agents/skills/app-store-compliance/hooks/app-store-compliance-guard.sh apps/mobile || true
  ```
  Expected: `typecheck`, `lint`, `format:check`, `@pekulo/web` tests, and `@pekulo/mobile` tests all exit 0; compliance guard shows zero `APPLE-5.1.1-MISSING-PRIVACY-POLICY`, zero `APPLE-EXPORT-COMPLIANCE-MISSING`, and zero `APPLE-ACCESSIBILITY-HAPTICS` findings (only the known `eas.json` `e2e-test` stub note and manual checks).
  Commit: `git add apps/mobile/__tests__/store-compliance.test.ts docs/architecture.md apps/mobile/README.md docs/epics.md docs/state.yaml && git commit -m "test(#163): add store compliance meta-test and sync docs"`

## Dev Notes

- **Commit Prefix Convention:** `feat(#163): <summary>` / `test(#163): <summary>` / `chore(#163): <summary>` (GitHub Issues integration, branch `feature/163-10-7-store-compliance-and-agent-testers`).
- **Parallelism with `10-6`:** `10-6-android-parity-and-maestro` (`#162`) owns Android account deletion (AC-4), Android Material Symbols, Android bottom action sheets, and Android Maestro CI. This story (`10-7`) depends only on `10-5` and addresses every non-Android-surface compliance blocker + the Mobile Agent Testers kit so both PRs can advance in parallel.
- **Public repo note:** `yabafre/pekulo` is `PUBLIC` (verified via `gh repo view`); `docs/state.yaml` `ticket_sync.projects.pekulo.visibility` is updated from stale `"PRIVATE"` to `"PUBLIC"`.

### Existing code at write time (Step-0 verbatim quotes)

`apps/web/src/proxy.ts:60-62` (current):
```ts
  if (request.nextUrl.pathname === "/v1/logos") {
    return withSecurity(response);
  }
```
This story adds `PUBLIC_LEGAL_PATHS = new Set(["/privacy", "/terms", "/support", "/account-deletion"])` alongside `/v1/logos` so all four legal pages return HTTP 200 without auth while retaining full security headers and CSP.

`apps/mobile/lib/supabase/secure-storage.ts:20-24, 129-142` (current):
```ts
export interface SecureStoreDriver {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}
```
This story widens `setItemAsync` to accept optional `SecureStore.SecureStoreOptions` and passes `{ keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }` on every write.

`apps/mobile/lib/auth/auth-context.tsx:93-97` (current):
```ts
export function AuthProvider({ children, initialSession = null, requireAuth }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();
  const enforceAuth = requireAuth ?? configured;
```
This story calls `assertReleaseSupabaseConfigured(configured)` when `requireAuth === undefined && initialSession === null`, failing fast in non-dev release builds unless `EXPO_PUBLIC_ALLOW_PREVIEW === "1"`.

`apps/mobile/app/parametres.tsx:52-57` (current):
```tsx
  function handleThirdPartyChange(next: boolean) {
    void run(
      () => llm.setThirdParty(next),
      next ? t("settings.ai.enabled") : t("settings.ai.disabled"),
    );
  }
```
This story gates `next === true` behind an explicit `Alert.alert` naming the configured third-party AI provider and data types sent (Apple Guideline 5.1.2(i)).

`apps/mobile/lib/hooks/use-mobile-mutations.ts:218-241` (current):
```ts
export function useLlmOptIn() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = [...mobileQueryKeys.llm(), isAuthenticated];
  const query = useQuery({
    queryKey,
    queryFn: async () => (isAuthenticated ? await llmClient.getOptIn() : { thirdParty: false }),
  });
  const mutation = useMutation({
    mutationFn: async (thirdParty: boolean) => {
      if (!isAuthenticated) throw new PreviewModeError();
      return await llmClient.setOptIn(validateInput(updateLlmOptInSchema, { thirdParty }));
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
    },
  });
  return {
    thirdParty: query.data?.thirdParty ?? false,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    setThirdParty: mutation.mutateAsync,
  };
}
```
This story adds `useAiNotice()` backed by existing `llmClient.getAiNotice()` / `llmClient.markAiNotice()` and invalidates the `ai-notice` query key when `setOptIn` succeeds.

`apps/mobile/components/form/sheet.tsx:31-56` (current):
```ts
  async function run(action: () => Promise<unknown>, successTitle?: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      await action();
      if (successTitle) toast.success(successTitle);
      if (dismiss && router.canGoBack()) router.back();
      return true;
    } catch (caught) {
```
This story invokes `hapticSuccess()` after `action()` resolves and `hapticError()` inside `catch`.

`apps/mobile/lib/actions.ts:50-65` (current):
```ts
export function confirmDestructive({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  Alert.alert(title, message, [
    { text: tNow("common.actions.cancel"), style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
```
This story invokes `hapticWarning()` when `confirmDestructive` opens.

### File structure design (3-bullet template per file)

- **`apps/web/src/proxy.ts`** (modify)
  - Single responsibility: Enforce edge security headers and auth redirects while exempting exact public legal paths.
  - Inputs + outputs: Imports `NextRequest`/`NextResponse` and security header builders; exports `proxy` and `config`.
- **`apps/web/src/app/(legal)/layout.tsx`** (create)
  - Single responsibility: Render the shared public legal shell and top navigation bar using `@pekulo/ui`.
  - Inputs + outputs: Imports `Link` (`next/link`) and `Text`/`View` (`@pekulo/ui/client`); exports `LegalLayout`.
- **`apps/web/src/app/(legal)/{privacy,terms,support,account-deletion}/page.tsx`** (create)
  - Single responsibility: Render each store-required public legal/support/deletion page without authentication.
  - Inputs + outputs: Imports `Metadata` (`next`) and `@pekulo/ui/client`; exports page component and `metadata`.
- **`apps/mobile/assets/{icon,adaptive-icon,splash-icon}.png`** (create)
  - Single responsibility: Canonical brand icons (`icon.png` 1024×1024 RGB no-alpha) and splash image consumed by `expo prebuild`.
  - Inputs + outputs: Generated from `apps/web/public/icons/_source/pekulo-icon-1024.png`; referenced by `apps/mobile/app.json`.
- **`apps/mobile/app.json`** (modify)
  - Single responsibility: Declare Expo app metadata, export compliance (`usesNonExemptEncryption: false`), `privacyManifests`, and canonical icon/splash paths.
  - Inputs + outputs: Consumed by Expo CLI, EAS Build, and `store-compliance.test.ts`.
- **`apps/mobile/eas.json`** (modify)
  - Single responsibility: Declare EAS build profiles including explicit `EXPO_PUBLIC_ALLOW_PREVIEW: "1"` for `e2e-test`.
  - Inputs + outputs: Consumed by EAS Build / Workflows and `store-compliance.test.ts`.
- **`apps/mobile/lib/legal.ts`** (create)
  - Single responsibility: Build validated HTTPS legal URLs and open them in the system browser.
  - Inputs + outputs: Reads `EXPO_PUBLIC_WEB_BASE_URL` and `Linking.openURL`; exports `LegalPath`, `getLegalUrl`, `openLegalUrl`.
- **`apps/mobile/lib/haptics.ts`** (create)
  - Single responsibility: Provide non-throwing tactile feedback helpers wrapping `expo-haptics`.
  - Inputs + outputs: Imports `expo-haptics`; exports `hapticSuccess`, `hapticError`, `hapticWarning`, `hapticSelection`.
- **`apps/mobile/lib/supabase/secure-storage.ts`** (modify)
  - Single responsibility: Persist chunked Supabase sessions in Keychain excluded from iCloud backups.
  - Inputs + outputs: Imports `expo-secure-store`; exports `SECURE_STORE_OPTIONS`, `createChunkedSecureStorage`, `chunkedSecureStorage`.
- **`apps/mobile/lib/auth/auth-context.tsx`** (modify)
  - Single responsibility: Manage mobile Supabase auth state and prevent silent preview-mode fallback in release builds.
  - Inputs + outputs: Reads Supabase config + `EXPO_PUBLIC_ALLOW_PREVIEW`; exports `assertReleaseSupabaseConfigured`, `AuthProvider`, `useAuth`.
- **`apps/mobile/components/ai-transparency-notice.tsx`** (create)
  - Single responsibility: Display and dismiss the mobile EU AI Act Art. 50 transparency banner when `llmClient.getAiNotice()` is unseen.
  - Inputs + outputs: Consumes `useAuth`, `useAiNotice`, `useI18n`, `@pekulo/ui`; exports `AiTransparencyNotice`.
- **`apps/mobile/.app-review-readiness.json` & `apps/mobile/docs/REVIEW-NOTES.md`** (create)
  - Single responsibility: Track manual store-submission checks and provide App Store / Play Store reviewer notes in English.
  - Inputs + outputs: Read by `app-store-compliance-guard.sh` and the human publisher before submission.
- **`apps/mobile/.agent-testers/{personas.json,AGENT_BRIEF.md,README.md}`** (create)
  - Single responsibility: Configure Pekulo's 8-persona Mobile Agent Testers runs for the public Bun/Expo monorepo.
  - Inputs + outputs: Copied into the testers repo or workflow; validated by `store-compliance.test.ts`.
- **`apps/mobile/__tests__/store-compliance.test.ts`** (create)
  - Single responsibility: Mechanically assert `app.json`, `eas.json`, RGB no-alpha `icon.png`, and `.agent-testers/personas.json` invariants.
  - Inputs + outputs: Reads config/asset files via `node:fs`; runs under Jest (`@pekulo/mobile`).

### Dependencies & Non-code Store Prerequisites

- **New npm package:** `expo-haptics` (installed via `bunx expo install expo-haptics` in `apps/mobile`).
- **Deferred (tracked in `.app-review-readiness.json`):** Universal Links (`associatedDomains` + `/.well-known/apple-app-site-association`) pending Apple Team ID & production domain; Apple/Google Organization Account (D-U-N-S) & EU DSA Trader verification (Google Play hard deadline 2027-02-01).

## File List

- Modify: `apps/web/src/proxy.ts`
- Create: `apps/web/src/proxy.legal.test.ts`
- Create: `apps/web/src/app/(legal)/layout.tsx`
- Create: `apps/web/src/app/(legal)/privacy/page.tsx`
- Create: `apps/web/src/app/(legal)/terms/page.tsx`
- Create: `apps/web/src/app/(legal)/support/page.tsx`
- Create: `apps/web/src/app/(legal)/account-deletion/page.tsx`
- Create: `apps/web/src/app/(legal)/legal-pages.test.tsx`
- Create: `apps/mobile/assets/icon.png`
- Create: `apps/mobile/assets/adaptive-icon.png`
- Create: `apps/mobile/assets/splash-icon.png`
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/eas.json`
- Modify: `apps/mobile/package.json`
- Modify: `bun.lock`
- Modify: `apps/mobile/jest.setup.ts`
- Create: `apps/mobile/lib/legal.ts`
- Create: `apps/mobile/lib/haptics.ts`
- Modify: `apps/mobile/lib/supabase/secure-storage.ts`
- Modify: `apps/mobile/lib/auth/auth-context.tsx`
- Modify: `apps/mobile/lib/hooks/use-mobile-mutations.ts`
- Modify: `apps/mobile/lib/actions.ts`
- Modify: `apps/mobile/components/form/sheet.tsx`
- Create: `apps/mobile/components/ai-transparency-notice.tsx`
- Modify: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/parametres.tsx`
- Modify: `apps/mobile/app/(tabs)/transactions/index.tsx`
- Modify: `apps/mobile/lib/i18n/messages/auth.ts`
- Modify: `apps/mobile/lib/i18n/messages/settings.ts`
- Modify: `apps/mobile/lib/i18n/messages/transactions.ts`
- Create: `apps/mobile/__tests__/legal-and-security.test.ts`
- Create: `apps/mobile/__tests__/ai-consent-and-notice.test.tsx`
- Modify: `apps/mobile/__tests__/settings-interactions.test.tsx`
- Create: `apps/mobile/__tests__/store-compliance.test.ts`
- Create: `apps/mobile/.app-review-readiness.json`
- Create: `apps/mobile/docs/REVIEW-NOTES.md`
- Create: `apps/mobile/.agent-testers/personas.json`
- Create: `apps/mobile/.agent-testers/AGENT_BRIEF.md`
- Create: `apps/mobile/.agent-testers/README.md`
- Create: `.agents/skills/app-store-compliance/**`
- Create: `.agents/skills/mobile-agent-testers/**`
- Create: `.claude/skills/app-store-compliance`
- Create: `.claude/skills/mobile-agent-testers`
- Modify: `skills-lock.json`
- Modify: `docs/epics.md`
- Modify: `docs/state.yaml`
- Modify: `docs/architecture.md`
- Modify: `apps/mobile/README.md`

## Dev Agent Record

### Summary

Implemented story `10-7-store-compliance-and-agent-testers` (`#163`) end-to-end across 10 focused commits on `feature/163-10-7-store-compliance-and-agent-testers`: public unauthenticated `/privacy`, `/terms` (EAA Annex V), `/support`, and `/account-deletion` web routes with exact edge-proxy bypass; canonical 1024×1024 RGB no-alpha mobile icon, adaptive icon, splash icon, iOS export compliance (`usesNonExemptEncryption: false`), and complete `privacyManifests`; Keychain `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` backup exclusion and release-mode Supabase fail-fast guard (`EXPO_PUBLIC_ALLOW_PREVIEW=1` opt-in for `e2e-test`); Apple 5.1.2(i) third-party AI consent modal, mobile `AiTransparencyNotice` (EU AI Act Art. 50 / DR-12), and localized in-app legal links; `expo-haptics` feedback, `.app-review-readiness.json`, and `REVIEW-NOTES.md`; English 8-persona Mobile Agent Testers kit + vendored skills; and a class-killer `store-compliance.test.ts` meta-test with full doc sync.

### Files changed

- `.agents/skills/app-store-compliance/**`
- `.agents/skills/mobile-agent-testers/**`
- `.claude/skills/app-store-compliance`
- `.claude/skills/mobile-agent-testers`
- `skills-lock.json`
- `apps/web/src/proxy.ts`
- `apps/web/src/proxy.legal.test.ts`
- `apps/web/src/app/(legal)/layout.tsx`
- `apps/web/src/app/(legal)/privacy/page.tsx`
- `apps/web/src/app/(legal)/terms/page.tsx`
- `apps/web/src/app/(legal)/support/page.tsx`
- `apps/web/src/app/(legal)/account-deletion/page.tsx`
- `apps/web/src/app/(legal)/legal-pages.test.tsx`
- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/splash-icon.png`
- `apps/mobile/app.json`
- `apps/mobile/eas.json`
- `apps/mobile/package.json`
- `bun.lock`
- `apps/mobile/jest.setup.ts`
- `apps/mobile/lib/legal.ts`
- `apps/mobile/lib/haptics.ts`
- `apps/mobile/lib/supabase/secure-storage.ts`
- `apps/mobile/lib/auth/auth-context.tsx`
- `apps/mobile/lib/hooks/use-mobile-mutations.ts`
- `apps/mobile/lib/actions.ts`
- `apps/mobile/components/form/sheet.tsx`
- `apps/mobile/components/ai-transparency-notice.tsx`
- `apps/mobile/app/login.tsx`
- `apps/mobile/app/parametres.tsx`
- `apps/mobile/app/(tabs)/transactions/index.tsx`
- `apps/mobile/lib/i18n/messages/auth.ts`
- `apps/mobile/lib/i18n/messages/settings.ts`
- `apps/mobile/lib/i18n/messages/transactions.ts`
- `apps/mobile/__tests__/legal-and-security.test.ts`
- `apps/mobile/__tests__/ai-consent-and-notice.test.tsx`
- `apps/mobile/__tests__/settings-interactions.test.tsx`
- `apps/mobile/__tests__/haptics.test.ts`
- `apps/mobile/__tests__/store-compliance.test.ts`
- `apps/mobile/.app-review-readiness.json`
- `apps/mobile/docs/REVIEW-NOTES.md`
- `apps/mobile/.agent-testers/personas.json`
- `apps/mobile/.agent-testers/AGENT_BRIEF.md`
- `apps/mobile/.agent-testers/README.md`
- `apps/mobile/README.md`
- `docs/architecture.md`
- `docs/epics.md`
- `docs/state.yaml`
- `docs/stories/10-7-store-compliance-and-agent-testers.md`

### Deviations

- **Tamagui `<View>` prop fix (`apps/web/src/app/(legal)/layout.tsx`):** Removed `color="$color"` from the outer `<View>` because Tamagui `View` accepts `StackStyleBase` only (every `<Text>` inside already declares its explicit `$color` token).
- **Tamagui test wrapper (`apps/web/src/app/(legal)/legal-pages.test.tsx`):** Wrapped rendered legal pages with `renderWithTamagui` from `../../../test/setup` (matching existing `@pekulo/web` component tests) and asserted `getAllByText(/Supabase/i)` because `/privacy` references Supabase in both sections 2 and 3.
- **Preview-mode preservation in `ParametresScreen#handleThirdPartyChange` (`apps/mobile/app/parametres.tsx`):** Kept unauthenticated preview toggles routing directly through `run(() => llm.setThirdParty(next))` so the Maestro `preview-guard.yaml` E2E flow still sees the sign-in prompt immediately, while authenticated toggles from off → on display the Apple 5.1.2(i) provider-naming consent modal (honouring AC-5 verbatim).
- **Extra unit test file (`apps/mobile/__tests__/haptics.test.ts`):** Added dedicated RED→GREEN Jest coverage for AC-6 (`hapticSuccess`/`hapticError`/`hapticWarning`/`hapticSelection` non-throwing guarantees and `confirmDestructive` wiring).
- **Node-free tsconfig typing (`apps/mobile/__tests__/store-compliance.test.ts`):** Typed `node:fs` / `node:path` inline and resolved `MOBILE_ROOT` via `require.resolve("../package.json")` (matching `maestro-ds-gallery-flow.test.ts`) because `apps/mobile/tsconfig.json` scopes `"types": ["jest"]` without `@types/node`.
- **Visual verification (React Grab MCP):** React Grab MCP was unavailable in this session (and does not apply to React Native); visual verification for the 4 static web `(legal)` pages is deferred to `aped-review`.

### Test output

- `bun run typecheck` → `Tasks: 10 successful, 10 total` (exit 0)
- `bun run lint` → `Found 3 warnings and 0 errors. Finished in 1.1s on 1246 files` (exit 0; 3 warnings are pre-existing outside this story)
- `bun run format:check` → `All matched files use the correct format. Finished in 1674ms on 1441 files` (exit 0)
- `bun --filter='@pekulo/web' run test` → `Test Files 127 passed (127)` / `Tests 444 passed (444)` (exit 0)
- `bun --filter='@pekulo/mobile' run test` → `Test Suites: 20 passed, 20 total` / `Tests: 209 passed, 209 total` (exit 0)
- `bash .agents/skills/app-store-compliance/hooks/app-store-compliance-guard.sh apps/mobile` → `Summary. critical=0 high=0 medium=0`; `Manual checks for this project. 2 of 7 attested for 0.1.0 (1), checked 2026-11-25.`

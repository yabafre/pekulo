import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";

import { renderWithTamagui } from "../../../test/setup";
import LegalLayout from "./layout";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";
import SupportPage, { metadata as supportMetadata } from "./support/page";
import AccountDeletionPage, { metadata as deletionMetadata } from "./account-deletion/page";

// AC-1 (verbatim from story 10-7-store-compliance-and-agent-testers:27):
//   each page renders using the Pekulo Design System only (zero app-local
//   Tailwind classes) covering GDPR/CNIL data processing, sub-processors
//   (Supabase, Bridge, optional LLM), EAA Annex V accessibility notice,
//   support contact, and step-by-step in-app and web account-deletion
//   instructions.
describe("Public legal & deletion pages (story 10-7, AC-1)", () => {
  it("renders /privacy inside LegalLayout with semantic landmarks, GDPR disclosures, and zero axe violations", async () => {
    const { container } = renderWithTamagui(
      <LegalLayout>
        <PrivacyPage />
      </LegalLayout>,
    );
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Legal navigation" })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /Privacy Policy/i })).toBeTruthy();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bridge/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "privacy@pekulo.app" }).getAttribute("href")).toBe(
      "mailto:privacy@pekulo.app",
    );
    expect(String(privacyMetadata.title)).not.toContain("Pekulo");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("renders /terms with EAA Annex V accessibility statement, headings, and zero axe violations", async () => {
    const { container } = renderWithTamagui(
      <LegalLayout>
        <TermsPage />
      </LegalLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /Terms of Service & Accessibility/i }),
    ).toBeTruthy();
    expect(screen.getByText(/Directive \(EU\) 2019\/882, Annex V/i)).toBeTruthy();
    expect(screen.getByText(/EN 301 549/i)).toBeTruthy();
    expect(String(termsMetadata.title)).not.toContain("Pekulo");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("renders /support with clickable email/GitHub links and zero axe violations", async () => {
    const { container } = renderWithTamagui(
      <LegalLayout>
        <SupportPage />
      </LegalLayout>,
    );
    expect(screen.getByRole("link", { name: "support@pekulo.app" }).getAttribute("href")).toBe(
      "mailto:support@pekulo.app",
    );
    expect(
      screen
        .getByRole("link", { name: /github\.com\/yabafre\/pekulo\/issues/i })
        .getAttribute("href"),
    ).toBe("https://github.com/yabafre/pekulo/issues");
    expect(String(supportMetadata.title)).not.toContain("Pekulo");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("renders /account-deletion with accurate 23-table erasure copy and zero axe violations", async () => {
    const { container } = renderWithTamagui(
      <LegalLayout>
        <AccountDeletionPage />
      </LegalLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /Account & Data Deletion/i }),
    ).toBeTruthy();
    expect(screen.getByText(/all 23 database tables/i)).toBeTruthy();
    expect(String(deletionMetadata.title)).not.toContain("Pekulo");

    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

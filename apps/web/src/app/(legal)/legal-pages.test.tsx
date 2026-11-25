import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithTamagui } from "../../../test/setup";
import LegalLayout from "./layout";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";
import SupportPage from "./support/page";
import AccountDeletionPage from "./account-deletion/page";

// AC-1 (verbatim from story 10-7-store-compliance-and-agent-testers:27):
//   each page renders using the Pekulo Design System only (zero app-local
//   Tailwind classes) covering GDPR/CNIL data processing, sub-processors
//   (Supabase, Bridge, optional LLM), EAA Annex V accessibility notice,
//   support contact, and step-by-step in-app and web account-deletion
//   instructions.
describe("Public legal & deletion pages (story 10-7, AC-1)", () => {
  it("renders /privacy inside LegalLayout with GDPR and sub-processor disclosures", () => {
    renderWithTamagui(
      <LegalLayout>
        <PrivacyPage />
      </LegalLayout>,
    );
    expect(screen.getByText(/Privacy Policy \/ Politique de confidentialité/i)).toBeTruthy();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Bridge/i)).toBeTruthy();
  });

  it("renders /terms with EAA Annex V accessibility statement", () => {
    renderWithTamagui(<TermsPage />);
    expect(screen.getByText(/Directive \(EU\) 2019\/882, Annex V/i)).toBeTruthy();
    expect(screen.getByText(/EN 301 549/i)).toBeTruthy();
  });

  it("renders /support with contact email and links", () => {
    renderWithTamagui(<SupportPage />);
    expect(screen.getByText(/support@pekulo\.app/i)).toBeTruthy();
  });

  it("renders /account-deletion with in-app and web deletion instructions", () => {
    renderWithTamagui(<AccountDeletionPage />);
    expect(screen.getByText(/Account & Data Deletion/i)).toBeTruthy();
    expect(screen.getByText(/all 21 database tables/i)).toBeTruthy();
  });
});

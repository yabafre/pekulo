import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.

import { AdvisoryDisclaimer } from "./advisory-disclaimer";
import { AdvisoryProviderBadge } from "./advisory-provider-badge";
import { AdvisoryRecommendationCard } from "./advisory-recommendation-card";

describe("advisory subcomponents", () => {
  it("renders AdvisoryDisclaimer with regulatory notice", () => {
    renderWithTamagui(<AdvisoryDisclaimer />);
    expect(screen.getByRole("region", { name: "Avertissement réglementaire" })).toBeInTheDocument();
    expect(
      screen.getByText(/ne constitue en aucun cas un conseil en investissement réglementé/i),
    ).toBeInTheDocument();
  });

  it("renders AdvisoryProviderBadge with provider, model and posture", () => {
    renderWithTamagui(
      <AdvisoryProviderBadge
        provider="anthropic"
        model="claude-3-5-sonnet"
        generatedAt="2026-10-27T18:00:00.000Z"
      />,
    );
    expect(screen.getByText(/anthropic \/ claude-3-5-sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/Hébergement UE · Politique Zero Data Retention/i)).toBeInTheDocument();
  });

  it("renders AdvisoryRecommendationCard with action, title, and instrument", () => {
    const recommendation = {
      id: "rec_1",
      title: "Arbitrage vers obligations souveraines",
      action: "buy" as const,
      priority: "high" as const,
      target: "Obligations",
      rationale: "Réduire le profil de risque et capter le rendement monétaire.",
      instrumentRecommendation: {
        symbol: "AGGH",
        isin: "IE00BDBRDM35",
        action: "buy" as const,
        rationale: "ETF global agrégé hedgé EUR.",
      },
    };

    renderWithTamagui(
      <AdvisoryRecommendationCard
        recommendation={recommendation}
        provider="anthropic"
        model="claude-3-5-sonnet"
      />,
    );

    expect(screen.getByText("Achat")).toBeInTheDocument();
    expect(screen.getByText("Arbitrage vers obligations souveraines")).toBeInTheDocument();
    expect(screen.getByText("Priorité Haute")).toBeInTheDocument();
    expect(screen.getByText("Cible : Obligations")).toBeInTheDocument();
    expect(
      screen.getByText("Réduire le profil de risque et capter le rendement monétaire."),
    ).toBeInTheDocument();
    expect(screen.getByText(/AGGH/)).toBeInTheDocument();
    expect(screen.getByText(/IE00BDBRDM35/)).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-3 (verbatim from story 12-4-advisory-private-page:19):
//   Given the rendered advisory page, When analysis and recommendations are shown,
//   Then the active provider, model, EU-region posture, and no-train guarantee are surfaced for transparency.
import fr from "../../../../messages/fr.json";
import en from "../../../../messages/en.json";

describe("advisory localization messages", () => {
  it("contains advisory namespace in fr.json with required keys", () => {
    expect(fr).toHaveProperty("advisory");
    const adv = (fr as Record<string, any>).advisory;
    expect(adv.title).toBeDefined();
    expect(adv.disclaimer.title).toBe("Avertissement réglementaire");
    expect(adv.disclaimer.body).toContain(
      "ne constitue en aucun cas un conseil en investissement réglementé",
    );
    expect(adv.actions.generate).toBeDefined();
    expect(adv.providerBadge.posture).toContain("Hébergement UE");
    expect(adv.recommendations.action.buy).toBe("Achat");
  });

  it("contains advisory namespace in en.json with required keys", () => {
    expect(en).toHaveProperty("advisory");
    const adv = (en as Record<string, any>).advisory;
    expect(adv.title).toBeDefined();
    expect(adv.disclaimer.title).toBe("Regulatory notice");
    expect(adv.disclaimer.body).toContain("does not constitute regulated investment advice");
    expect(adv.actions.generate).toBeDefined();
    expect(adv.providerBadge.posture).toContain("EU hosted");
    expect(adv.recommendations.action.buy).toBe("Buy");
  });
});

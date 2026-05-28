import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";
import { CompassSetupCta } from "./compass-setup-cta";

describe("CompassSetupCta a11y", () => {
  test("no critical/serious axe violations", async () => {
    const { container } = renderWithTamagui(<CompassSetupCta onAddMilestone={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

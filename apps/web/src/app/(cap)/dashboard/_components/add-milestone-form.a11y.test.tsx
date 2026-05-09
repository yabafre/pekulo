import { describe, expect, test } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../test/setup";
import { AddMilestoneForm } from "./add-milestone-form";

describe("AddMilestoneForm a11y", () => {
  test("zero critical/serious axe violations + 20-cap visible", async () => {
    const qc = new QueryClient();
    const { container, getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <AddMilestoneForm milestoneCount={20} horizonAbsoluteYearMax={2050} />
      </QueryClientProvider>,
    );
    expect(getByRole("status").textContent).toContain("20/20");
    const submit = getByRole("button", { name: /Ajouter le palier|Ajout…/ });
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

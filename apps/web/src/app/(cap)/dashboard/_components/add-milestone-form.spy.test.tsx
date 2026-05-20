import { describe, expect, test, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../test/setup";

// AC-4 verbatim: "Clicking the disabled button does NOT trigger the mutation
// (verified via spy: addMilestoneSpy is called 0 times)." Mock the server
// action at the boundary so the hook's mutationFn becomes the spy itself —
// any click that slips past the cap-reached gate calls the spy, otherwise
// it stays at 0.
const addSpy = vi.fn();
vi.mock("../_actions/milestones-actions", () => ({
  addMilestone: (input: unknown) => addSpy(input),
}));

import { AddMilestoneForm } from "./add-milestone-form";

describe("AddMilestoneForm — AC-4 cap spy", () => {
  test("clicking the disabled cap-reached button never calls addMilestone", () => {
    addSpy.mockReset();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByRole } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <AddMilestoneForm milestoneCount={20} horizonAbsoluteYearMax={2050} />
      </QueryClientProvider>,
    );
    const button = getByRole("button", { name: /Ajouter le palier|Ajout…/ });
    // Sanity: the button is disabled (browser blocks click), AND aria says so.
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // Three rapid clicks — none should reach the mutation.
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(addSpy).toHaveBeenCalledTimes(0);
  });
});

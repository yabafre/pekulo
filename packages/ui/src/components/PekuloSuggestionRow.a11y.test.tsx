import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSuggestionRow } from "./PekuloSuggestionRow";

describe("PekuloSuggestionRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Tx",
          account: "PEA",
          dateLabel: "1 jan",
          direction: "in",
          amountEur: 100,
          suggestedCategory: "Salaire",
          confidence: 0.9,
          route: "ios",
        }}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("calls onConfirm + onEdit", () => {
    const onConfirm = vi.fn();
    const onEdit = vi.fn();
    const { getByLabelText } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Tx",
          account: "PEA",
          dateLabel: "1 jan",
          direction: "in",
          amountEur: 100,
          suggestedCategory: "Salaire",
          confidence: 0.9,
          route: "ios",
        }}
        onConfirm={onConfirm}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(getByLabelText("Confirmer la catégorie"));
    fireEvent.click(getByLabelText("Modifier la catégorie"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

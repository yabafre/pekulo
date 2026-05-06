import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSuggestionRow } from "./PekuloSuggestionRow";

describe("PekuloSuggestionRow snapshot", () => {
  it("renders pending suggestion", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Carrefour",
          account: "CB Bourso",
          dateLabel: "12 mai",
          direction: "out",
          amountEur: 87,
          suggestedCategory: "Courses",
          confidence: 0.91,
          route: "ios",
        }}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders low-confidence (<75%) warning tone", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "AMZN MKTPL",
          account: "CB",
          dateLabel: "10 mai",
          direction: "out",
          amountEur: 42,
          suggestedCategory: "Maison",
          confidence: 0.62,
          route: "cloud",
        }}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

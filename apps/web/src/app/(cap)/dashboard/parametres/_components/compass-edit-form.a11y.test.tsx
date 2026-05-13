import { describe, expect, test } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../test/setup";
import { CompassEditForm } from "./compass-edit-form";

describe("CompassEditForm a11y", () => {
  test("no critical/serious axe violations with pre-filled values", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CompassEditForm initial={{ objectif: 800_000, horizonYears: 25 }} />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

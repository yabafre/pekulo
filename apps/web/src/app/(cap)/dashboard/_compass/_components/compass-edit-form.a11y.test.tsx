import { describe, expect, test } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { compassKeys } from "@/lib/zapaction/keys";
import { renderWithTamagui } from "../../../../../../test/setup";
import { CompassEditForm } from "./compass-edit-form";

describe("CompassEditForm a11y", () => {
  test("no critical/serious axe violations with pre-filled values", async () => {
    const qc = new QueryClient();
    // Seed the compass query cache so the form's `useCompass()` read
    // hydrates immediately; the form then mirrors the values into its
    // controlled inputs. Replaces the legacy `initial` prop now that
    // the read flows exclusively through React Query.
    qc.setQueryData(compassKeys.current(), { objectif: 800_000, horizonYears: 25 });
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <CompassEditForm />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

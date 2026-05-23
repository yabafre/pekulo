import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import {
  PekuloField,
  PekuloFieldDescription,
  PekuloFieldError,
  PekuloFieldGroup,
  PekuloFieldLabel,
  PekuloFieldLegend,
  PekuloFieldSet,
} from "./PekuloField";
import { PekuloInput } from "./PekuloInput";

describe("PekuloField family a11y", () => {
  it("composed form has role=group + label association + no critical violations", async () => {
    const { container, getByLabelText, getByRole } = renderWithTamagui(
      <PekuloFieldSet>
        <PekuloFieldLegend>Profil</PekuloFieldLegend>
        <PekuloFieldGroup>
          <PekuloField>
            <PekuloFieldLabel htmlFor="email">Email</PekuloFieldLabel>
            <PekuloInput id="email" type="email" defaultValue="alex@pekulo.fr" />
            <PekuloFieldDescription>Adresse de contact principale.</PekuloFieldDescription>
          </PekuloField>
          <PekuloField invalid>
            <PekuloFieldLabel htmlFor="age">Âge</PekuloFieldLabel>
            <PekuloInput id="age" type="number" invalid defaultValue="-1" />
            <PekuloFieldError>{"Âge invalide (>= 0)"}</PekuloFieldError>
          </PekuloField>
        </PekuloFieldGroup>
      </PekuloFieldSet>,
    );
    expect(getByLabelText("Email")).toBeTruthy();
    expect(getByLabelText("Âge")).toBeTruthy();
    expect(getByRole("alert")).toBeTruthy();
    expect(container.querySelectorAll('[role="group"]').length).toBeGreaterThan(0);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("FieldError dedupes TanStack-shaped errors and renders a list when > 1", () => {
    const errors = [{ message: "Required" }, { message: "Required" }, { message: "Too short" }];
    const { getAllByRole, getByText } = renderWithTamagui(<PekuloFieldError errors={errors} />);
    expect(getAllByRole("alert").length).toBe(1);
    expect(getByText("Required")).toBeTruthy();
    expect(getByText("Too short")).toBeTruthy();
  });

  it("FieldError returns null when no children + no errors", () => {
    const { container } = renderWithTamagui(<PekuloFieldError />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

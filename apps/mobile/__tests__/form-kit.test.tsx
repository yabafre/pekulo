import { PekuloRootProvider } from "@pekulo/ui";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState, type ReactNode } from "react";
import { ActionSheetIOS, Alert } from "react-native";

import { AmountField, SelectField, SwitchField, TextField } from "../components/form/fields";
import { confirmDestructive, handleMutationError, showActions } from "../lib/actions";
import { FormValidationError } from "../lib/forms";
import { PreviewModeError } from "../lib/hooks/use-mobile-mutations";

function wrap(ui: ReactNode) {
  return render(<PekuloRootProvider theme="pekulo-light">{ui}</PekuloRootProvider>);
}

// AC-6 (verbatim from story 10-4-mobile-auth-and-orpc:21):
//   ... Then each action calls the matching `@pekulo/contracts` procedure with input
//   validated by the shared `@pekulo/validators` schema through native iOS sheets,
//   action sheets, and destructive confirmations, the affected screens refresh
//   immediately, And in unauthenticated preview mode every mutation is blocked with a
//   sign-in prompt and no remote call.
describe("AC-6 — native action sheets and destructive confirmations", () => {
  afterEach(() => jest.restoreAllMocks());

  it("showActions opens a native iOS action sheet with cancel and destructive indexes", () => {
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation((_opts, cb) => cb(1));
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    showActions("Courses", [
      { label: "Modifier", onPress: onEdit },
      { label: "Supprimer", destructive: true, onPress: onDelete },
    ]);

    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Courses",
        options: ["Modifier", "Supprimer", "Annuler"],
        cancelButtonIndex: 2,
        destructiveButtonIndex: [1],
      }),
      expect.any(Function),
    );
    expect(onDelete).toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("confirmDestructive asks with a destructive Alert before running the action", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    const onConfirm = jest.fn();
    confirmDestructive({
      title: "Supprimer la transaction ?",
      message: "Cette action est définitive.",
      confirmLabel: "Supprimer",
      onConfirm,
    });
    expect(alert).toHaveBeenCalledWith(
      "Supprimer la transaction ?",
      "Cette action est définitive.",
      expect.arrayContaining([
        expect.objectContaining({ text: "Annuler", style: "cancel" }),
        expect.objectContaining({ text: "Supprimer", style: "destructive" }),
      ]),
    );
    expect(onConfirm).toHaveBeenCalled();
  });

  it("preview mode errors prompt a sign-in; validation errors are returned inline", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === "Se connecter")?.onPress?.();
    });
    const goToLogin = jest.fn();
    const toastDanger = jest.fn();

    expect(handleMutationError(new PreviewModeError(), { goToLogin, toastDanger })).toBeNull();
    expect(alert).toHaveBeenCalledWith("Mode aperçu", expect.any(String), expect.any(Array));
    expect(goToLogin).toHaveBeenCalled();

    expect(
      handleMutationError(new FormValidationError("Libellé requis"), { goToLogin, toastDanger }),
    ).toBe("Libellé requis");

    expect(handleMutationError(new Error("boom"), { goToLogin, toastDanger })).toBeNull();
    expect(toastDanger).toHaveBeenCalled();
  });
});

describe("AC-6 — native form fields", () => {
  afterEach(() => jest.restoreAllMocks());

  it("SelectField picks a value through the native action sheet", async () => {
    jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(1));
    function Harness() {
      const [value, setValue] = useState("inflow");
      return (
        <SelectField
          label="Type"
          value={value}
          onChange={setValue}
          options={[
            { value: "inflow", label: "Entrée" },
            { value: "outflow", label: "Sortie" },
          ]}
          testID="type-select"
        />
      );
    }
    await wrap(<Harness />);
    expect(screen.getByText("Entrée")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("type-select"));
    expect(screen.getByText("Sortie")).toBeTruthy();
  });

  it("AmountField, TextField and SwitchField report typed values", async () => {
    const onAmount = jest.fn();
    const onText = jest.fn();
    const onSwitch = jest.fn();
    await wrap(
      <>
        <AmountField label="Montant" value="" onChange={onAmount} testID="amount" />
        <TextField
          label="Libellé"
          value=""
          onChange={onText}
          testID="label"
          error="Libellé requis"
        />
        <SwitchField label="Imprévu" value={false} onChange={onSwitch} testID="imprevu" />
      </>,
    );
    await fireEvent.changeText(screen.getByTestId("amount"), "12,5");
    await fireEvent.changeText(screen.getByTestId("label"), "Courses");
    await fireEvent(screen.getByTestId("imprevu"), "valueChange", true);
    expect(onAmount).toHaveBeenCalledWith("12,5");
    expect(onText).toHaveBeenCalledWith("Courses");
    expect(onSwitch).toHaveBeenCalledWith(true);
    expect(screen.getByText("Libellé requis")).toBeTruthy();
  });
});

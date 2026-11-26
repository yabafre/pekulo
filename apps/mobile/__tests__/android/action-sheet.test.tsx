// apps/mobile/__tests__/android/action-sheet.test.tsx
// Story 10-6 AC-3 — on Android, `showActions` must list EVERY action plus
// Annuler (Alert.alert caps Android dialogs at three buttons, which silently
// dropped Immobilier's 5-action menu). The iOS half ("iOS keeps its native
// action sheet") is asserted by __tests__/form-kit.test.tsx (ActionSheetIOS).
//
// AC-3 (verbatim from story 10-6-android-parity-and-maestro):
//   Given a row action menu with N actions (Immobilier has 5, Cap has 3, a select
//   field has one per option), When it opens on Android, Then a Pekulo DS bottom
//   sheet lists all N actions plus « Annuler », destructive actions in the danger
//   colour, pressing an action closes the sheet then runs exactly that action, and
//   « Annuler » runs none; And no system alert dialog (capped at three buttons on
//   Android) is used for menus; And iOS keeps its native action sheet.
import { PekuloRootProvider, pekuloColors } from "@pekulo/ui";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, BackHandler, Platform, StyleSheet } from "react-native";

import { ActionSheetHost, closeActionSheet } from "../../lib/action-sheet-host";
import { showActions } from "../../lib/actions";

const LABELS = ["Mettre à jour la valeur", "Historique", "Crédit", "Location", "Supprimer"];

async function renderHost() {
  await render(
    <PekuloRootProvider theme="pekulo-light">
      <ActionSheetHost />
    </PekuloRootProvider>,
  );
}

async function openFiveActionMenu() {
  const entries = LABELS.map((label) => ({ label, onPress: jest.fn() }));
  await renderHost();
  await act(async () => {
    showActions(
      "Appartement Lyon",
      entries.map(({ label, onPress }) => ({
        label,
        destructive: label === "Supprimer",
        onPress,
      })),
    );
  });
  return entries.map(({ onPress }) => onPress);
}

function textColor(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)?.color;
}

describe("Android row action menus (story 10-6, AC-3)", () => {
  afterEach(async () => {
    // RNTL 14 `act` is async: an un-awaited act leaks its scope into the next
    // test and swallows that test's sheet render.
    await act(async () => closeActionSheet());
    jest.restoreAllMocks();
  });

  it("lists all five actions plus Annuler in a DS sheet and runs only the pressed one", async () => {
    expect(Platform.OS).toBe("android");
    const alertSpy = jest.spyOn(Alert, "alert");
    const handlers = await openFiveActionMenu();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByText("Appartement Lyon")).toBeTruthy();
    for (const label of [...LABELS, "Annuler"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    await fireEvent.press(screen.getByTestId("action-sheet-item-3"));
    expect(handlers[3]).toHaveBeenCalledTimes(1);
    for (const index of [0, 1, 2, 4]) expect(handlers[index]).not.toHaveBeenCalled();
  });

  it("paints destructive actions in the danger colour and the others in ink", async () => {
    await openFiveActionMenu();
    const danger = pekuloColors.light.perf.loss;
    expect(textColor("action-sheet-item-4-label")).toBe(danger);
    for (const index of [0, 1, 2, 3]) {
      expect(textColor(`action-sheet-item-${index}-label`)).not.toBe(danger);
    }
  });

  it("closes the sheet before running the action, so an action can open the next menu", async () => {
    await renderHost();
    const second = jest.fn();
    await act(async () => {
      showActions("Premier menu", [
        {
          label: "Ouvrir le suivant",
          onPress: () => showActions("Second menu", [{ label: "Choix", onPress: second }]),
        },
      ]);
    });
    await fireEvent.press(screen.getByTestId("action-sheet-item-0"));
    // Run-then-close would have closed the menu the action just opened.
    expect(screen.getByText("Second menu")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("action-sheet-item-0"));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("closes without running anything on Annuler", async () => {
    const handlers = await openFiveActionMenu();
    await fireEvent.press(screen.getByTestId("action-sheet-cancel"));
    for (const handler of handlers) expect(handler).not.toHaveBeenCalled();
    // The closed sheet ignores presses on its (still animating) rows.
    await fireEvent.press(screen.getByTestId("action-sheet-item-0"));
    expect(handlers[0]).not.toHaveBeenCalled();
  });

  it("consumes the hardware back press to close the menu without running anything", async () => {
    let onBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const remove = jest.fn();
    const addSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        onBack = handler;
        return { remove };
      });
    await renderHost();
    // Closed: back must keep reaching the navigator.
    expect(addSpy).not.toHaveBeenCalled();
    const entries = LABELS.map(() => jest.fn());
    await act(async () => {
      showActions(
        "Appartement Lyon",
        LABELS.map((label, index) => ({ label, onPress: entries[index] ?? jest.fn() })),
      );
    });
    const handlers = entries;

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(onBack).toBeDefined();
    let consumed: boolean | null | undefined;
    await act(async () => {
      consumed = onBack?.({} as Parameters<NonNullable<typeof onBack>>[0]);
    });
    expect(consumed).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
    for (const handler of handlers) expect(handler).not.toHaveBeenCalled();
  });

  it("renders every option when two options share a label", async () => {
    const consoleError = jest.spyOn(console, "error");
    await renderHost();
    const first = jest.fn();
    const second = jest.fn();
    await act(async () => {
      showActions("Compte", [
        { label: "Compte courant", onPress: first },
        { label: "Compte courant", onPress: second },
      ]);
    });
    expect(screen.getAllByText("Compte courant")).toHaveLength(2);
    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes("same key")),
    );
    expect(duplicateKeyWarnings).toEqual([]);
    await fireEvent.press(screen.getByTestId("action-sheet-item-1"));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

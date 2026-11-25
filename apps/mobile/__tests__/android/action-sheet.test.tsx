// apps/mobile/__tests__/android/action-sheet.test.tsx
// Story 10-6 AC-3 — on Android, `showActions` must list EVERY action plus
// Annuler (Alert.alert caps Android dialogs at three buttons, which silently
// dropped Immobilier's 5-action menu).
//
// AC-3 (verbatim from story 10-6-android-parity-and-maestro):
//   Given a row action menu with N actions (Immobilier has 5, Cap has 3, a select
//   field has one per option), When it opens on Android, Then a Pekulo DS bottom
//   sheet lists all N actions plus « Annuler », destructive actions in the danger
//   colour, pressing an action closes the sheet then runs exactly that action, and
//   « Annuler » runs none; And no system alert dialog (capped at three buttons on
//   Android) is used for menus; And iOS keeps its native action sheet.
import { PekuloRootProvider } from "@pekulo/ui";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Platform } from "react-native";

import { ActionSheetHost, closeActionSheet } from "../../lib/action-sheet-host";
import { showActions } from "../../lib/actions";

const LABELS = ["Mettre à jour la valeur", "Historique", "Crédit", "Location", "Supprimer"];

async function openFiveActionMenu() {
  const entries = LABELS.map((label) => ({ label, onPress: jest.fn() }));
  await render(
    <PekuloRootProvider theme="pekulo-light">
      <ActionSheetHost />
    </PekuloRootProvider>,
  );
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
    expect(screen.queryByText("Historique")).toBeNull();
  });

  it("closes without running anything on Annuler", async () => {
    const handlers = await openFiveActionMenu();
    await fireEvent.press(screen.getByTestId("action-sheet-cancel"));
    for (const handler of handlers) expect(handler).not.toHaveBeenCalled();
    expect(screen.queryByText("Appartement Lyon")).toBeNull();
  });
});

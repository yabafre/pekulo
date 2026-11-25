import * as Haptics from "expo-haptics";
import { Alert } from "react-native";

import { confirmDestructive } from "../lib/actions";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "../lib/haptics";

// AC-6 (verbatim from story 10-7-store-compliance-and-agent-testers:32):
//   Given a mobile mutation completing (success or failure) or a destructive
//   confirmation prompt opening, When the interaction fires, Then the
//   corresponding non-throwing haptic feedback triggers
describe("tactile haptics (story 10-7, AC-6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("triggers notification and selection haptics without throwing when native rejects", async () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error("no haptic engine"));
    expect(() => hapticSuccess()).not.toThrow();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );

    hapticError();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    hapticWarning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );

    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("no haptic engine"));
    expect(() => hapticSelection()).not.toThrow();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("fires hapticWarning when confirmDestructive opens", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    confirmDestructive({
      title: "Supprimer ?",
      message: "Action définitive",
      confirmLabel: "Supprimer",
      onConfirm: jest.fn(),
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});

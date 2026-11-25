import { PekuloRootProvider } from "@pekulo/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, Text } from "react-native";

import { useMutationRunner } from "../components/form/sheet";
import { confirmDestructive } from "../lib/actions";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "../lib/haptics";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useRouter: () => ({
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

function MutationHarness({ shouldFail }: { shouldFail: boolean }) {
  const { run } = useMutationRunner();
  return (
    <Pressable
      testID="run-mutation-btn"
      onPress={() => {
        void run(async () => {
          if (shouldFail) throw new Error("boom");
        }, "Enregistré");
      }}
    >
      <Text>Run</Text>
    </Pressable>
  );
}

// AC-6 (verbatim from story 10-7-store-compliance-and-agent-testers:32):
//   Given a mobile mutation completing (success or failure) or a destructive
//   confirmation prompt opening, When the interaction fires, Then the
//   corresponding non-throwing haptic feedback triggers
describe("tactile haptics (story 10-7, AC-6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("triggers notification and selection haptics without throwing on async rejection or sync throw", () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error("no haptic engine"));
    expect(() => hapticSuccess()).not.toThrow();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );

    (Haptics.notificationAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("sync bridge failure");
    });
    expect(() => hapticError()).not.toThrow();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);

    hapticWarning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );

    (Haptics.selectionAsync as jest.Mock).mockImplementationOnce(() => {
      throw new Error("sync bridge failure");
    });
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

  it("fires hapticSuccess when useMutationRunner resolves and hapticError when it rejects", async () => {
    const okView = await render(
      <PekuloRootProvider theme="pekulo-light">
        <MutationHarness shouldFail={false} />
      </PekuloRootProvider>,
    );
    await fireEvent.press(screen.getByTestId("run-mutation-btn"));
    await waitFor(() =>
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success,
      ),
    );
    await okView.unmount();

    (Haptics.notificationAsync as jest.Mock).mockClear();
    await render(
      <PekuloRootProvider theme="pekulo-light">
        <MutationHarness shouldFail={true} />
      </PekuloRootProvider>,
    );
    await fireEvent.press(screen.getByTestId("run-mutation-btn"));
    await waitFor(() =>
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error,
      ),
    );
  });
});

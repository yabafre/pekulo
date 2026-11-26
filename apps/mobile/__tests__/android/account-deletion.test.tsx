// apps/mobile/__tests__/android/account-deletion.test.tsx
// Story 10-6 AC-2 / AC-4 — Paramètres and account deletion on Android.
//
// AC-4 (verbatim from story 10-6-android-parity-and-maestro):
//   Given an authenticated user on Android, When they press « Supprimer mon compte
//   » in Paramètres, Then a deletion sheet opens; typing an email that does not
//   match the account email (ignoring case and surrounding spaces) shows the «
//   E-mail incorrect » alert and calls nothing; typing the matching email deletes
//   the account, signs out and returns to the login screen; And iOS keeps its
//   native text prompt, with the same email check on both platforms.
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: mockReplace,
      dismissAll: mockDismissAll,
      canDismiss: () => true,
      canGoBack: () => true,
    }),
  };
});

jest.mock("expo-router/stack", () =>
  require("./helpers/android-stack-mock").createAndroidStackMock(),
);

jest.mock("../../lib/orpc/modules", () => {
  const actual = jest.requireActual("../../lib/orpc/modules");
  return {
    ...actual,
    compassClient: { getCompass: jest.fn(), updateCompass: jest.fn() },
    llmClient: { getOptIn: jest.fn(), setOptIn: jest.fn() },
    settingsClient: {
      get: jest.fn(),
      updateTheme: jest.fn(),
      updateLang: jest.fn(),
      deleteAccount: jest.fn(),
    },
  };
});

import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert } from "react-native";

import ParametresScreen from "../../app/parametres";
import DeleteAccountSheet from "../../app/sheets/delete-account";
import { AuthProvider, createMobileQueryClient } from "../../lib/auth/auth-context";
import { compassClient, llmClient, settingsClient } from "../../lib/orpc/modules";
import { supabase } from "../../lib/supabase/client";
import { deleteAccountResult } from "../helpers/contract-fixtures";

const SESSION: Session = {
  access_token: "jwt",
  refresh_token: "r",
  expires_in: 3600,
  expires_at: 1999999999,
  token_type: "bearer",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "alex@pekulo.app",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-05-03T00:00:00Z",
  },
};

async function renderLive(ui: ReactNode, session: Session = SESSION) {
  const queryClient = createMobileQueryClient();
  return await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <AuthProvider initialSession={session} requireAuth={false}>
          {ui}
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
}

describe("Paramètres and account deletion on Android (story 10-6, AC-2/AC-4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    (compassClient.getCompass as jest.Mock).mockResolvedValue({
      objectif: 800000,
      horizonYears: 30,
    });
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "fr" });
  });

  it("renders Paramètres with its own title and no Stack.Toolbar", async () => {
    await renderLive(<ParametresScreen />);
    expect(await screen.findByText("Paramètres")).toBeTruthy();
    expect(screen.getByTestId("delete-account-btn")).toBeTruthy();
  });

  it("opens the deletion sheet instead of Alert.prompt", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    await renderLive(<ParametresScreen />);
    await fireEvent.press(await screen.findByTestId("delete-account-btn"));
    expect(mockPush).toHaveBeenCalledWith("/sheets/delete-account");
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("refuses a non-matching email without calling the API", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderLive(<DeleteAccountSheet />);
    await fireEvent.changeText(screen.getByTestId("delete-account-email"), "bob@pekulo.app");
    await fireEvent.press(screen.getByTestId("delete-account-confirm-btn"));
    expect(alertSpy).toHaveBeenCalledWith(
      "E-mail incorrect",
      "Saisissez exactement l’adresse e-mail de votre compte.",
    );
    expect(settingsClient.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account after typing the account email, then signs out", async () => {
    (settingsClient.deleteAccount as jest.Mock).mockResolvedValue(deleteAccountResult());
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
    await renderLive(<DeleteAccountSheet />);
    await fireEvent.changeText(screen.getByTestId("delete-account-email"), " Alex@Pekulo.app ");
    await fireEvent.press(screen.getByTestId("delete-account-confirm-btn"));
    await waitFor(() =>
      expect(settingsClient.deleteAccount).toHaveBeenCalledWith({
        confirmationEmail: "Alex@Pekulo.app",
      }),
    );
    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    // Paramètres sits under this sheet: dismiss the whole sheet stack first.
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockDismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("explains that the account email is unavailable instead of « E-mail incorrect »", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderLive(<DeleteAccountSheet />, {
      ...SESSION,
      user: { ...SESSION.user, email: undefined },
    });
    await fireEvent.changeText(screen.getByTestId("delete-account-email"), "alex@pekulo.app");
    await fireEvent.press(screen.getByTestId("delete-account-confirm-btn"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Supprimer mon compte ?",
      "L’adresse e-mail de votre compte est introuvable. Reconnectez-vous puis réessayez.",
    );
    expect(settingsClient.deleteAccount).not.toHaveBeenCalled();
  });
});

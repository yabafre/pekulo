import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert } from "react-native";

import ParametresScreen from "../app/parametres";
import CompassSheet from "../app/sheets/compass";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { compassClient, llmClient, settingsClient } from "../lib/orpc/modules";
import { supabase } from "../lib/supabase/client";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({}),
    useRouter: () => ({
      back: mockBack,
      push: mockPush,
      replace: mockReplace,
      canGoBack: () => true,
    }),
  };
});

jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = function MockStackScreen() {
    return null;
  };
  function MockToolbar({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockToolbar.Button = function MockToolbarButton({
    children,
    onPress,
    accessibilityLabel,
    variant,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    variant?: string;
  }) {
    const RN = require("react-native") as typeof import("react-native");
    return React.createElement(
      RN.Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel,
        onPress,
        testID: variant === "done" ? "sheet-primary-btn" : undefined,
      },
      typeof children === "string" ? React.createElement(RN.Text, null, children) : null,
    );
  };
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
});

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
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

async function renderLive(ui: ReactNode) {
  const queryClient = createMobileQueryClient();
  return await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <AuthProvider initialSession={SESSION} requireAuth={false}>
          {ui}
        </AuthProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
}

// AC-6 (verbatim from story 10-4-mobile-auth-and-orpc:21):
//   ... edits the compass objective and horizon, toggles the third-party AI opt-in, or
//   deletes the account, Then each action calls the matching `@pekulo/contracts`
//   procedure with input validated by the shared `@pekulo/validators` schema through
//   native iOS sheets, action sheets, and destructive confirmations ...
describe("AC-6 — Paramètres interactions", () => {
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

  it("edits the compass objective and horizon", async () => {
    (compassClient.updateCompass as jest.Mock).mockResolvedValue({});
    await renderLive(<CompassSheet />);
    await waitFor(() => expect(screen.getByDisplayValue("800000")).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId("compass-objectif"), "900 000");
    await fireEvent.changeText(screen.getByTestId("compass-horizon"), "25");
    await fireEvent.press(screen.getByTestId("sheet-primary-btn"));
    await waitFor(() =>
      expect(compassClient.updateCompass).toHaveBeenCalledWith({
        objectif: 900000,
        horizonYears: 25,
      }),
    );
  });

  it("toggles the third-party AI opt-in from Paramètres", async () => {
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    await renderLive(<ParametresScreen />);
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());
    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
    await waitFor(() => expect(llmClient.setOptIn).toHaveBeenCalledWith({ thirdParty: true }));
  });

  it("opens the compass sheet from Paramètres", async () => {
    await renderLive(<ParametresScreen />);
    await fireEvent.press(await screen.findByTestId("compass-row"));
    expect(mockPush).toHaveBeenCalledWith("/sheets/compass");
  });

  it("deletes the account after typing the account email, then signs out", async () => {
    (settingsClient.deleteAccount as jest.Mock).mockResolvedValue({ ok: true });
    const signOutSpy = jest.spyOn(supabase.auth, "signOut").mockResolvedValue({ error: null });
    jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, buttons) => {
      if (Array.isArray(buttons)) {
        const confirm = buttons.find((b) => b.style === "destructive")?.onPress as
          | ((value: string) => void)
          | undefined;
        confirm?.("alex@pekulo.app");
      }
    });
    await renderLive(<ParametresScreen />);
    await fireEvent.press(await screen.findByTestId("delete-account-btn"));
    await waitFor(() =>
      expect(settingsClient.deleteAccount).toHaveBeenCalledWith({
        confirmationEmail: "alex@pekulo.app",
      }),
    );
    await waitFor(() => expect(signOutSpy).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("refuses the deletion when the typed email does not match", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, buttons) => {
      if (Array.isArray(buttons)) {
        const confirm = buttons.find((b) => b.style === "destructive")?.onPress as
          | ((value: string) => void)
          | undefined;
        confirm?.("autre@exemple.fr");
      }
    });
    await renderLive(<ParametresScreen />);
    await fireEvent.press(await screen.findByTestId("delete-account-btn"));
    expect(settingsClient.deleteAccount).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("E-mail incorrect", expect.any(String));
  });
});

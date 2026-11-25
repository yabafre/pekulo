import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert, Linking } from "react-native";

import LoginScreen from "../app/login";
import ParametresScreen from "../app/parametres";
import { AiTransparencyNotice } from "../components/ai-transparency-notice";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { compassClient, llmClient, settingsClient } from "../lib/orpc/modules";

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

jest.mock("expo-router/stack", () => {
  const React = require("react") as typeof import("react");
  function MockStack({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockStack.Screen = () => null;
  function MockToolbar({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  MockToolbar.Button = () => null;
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
});

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    compassClient: { getCompass: jest.fn() },
    llmClient: {
      getOptIn: jest.fn(),
      setOptIn: jest.fn(),
      getAiNotice: jest.fn(),
      markAiNotice: jest.fn(),
    },
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

// AC-2 & AC-5 (verbatim from story 10-7-store-compliance-and-agent-testers:28,31):
//   AC-2: Given a mobile user on the Sign-in or Settings screen, When the
//   screen renders, Then localized (French and English) links to Privacy
//   Policy, Terms of Service, and Support open the canonical HTTPS URLs
//   (defaulting to `https://pekulo.app` when no HTTPS override is configured)
//   in the system browser.
//   AC-5: Given an authenticated mobile user in Settings turning third-party
//   AI models on, When the toggle switches from off to on, Then an explicit
//   consent dialog names the configured third-party AI provider and the exact
//   data fields transmitted (transaction label, amount, currency, date — zero
//   personal identifiers or account numbers), persists the opt-in only after
//   confirmation, and invalidates the AI notice cache; turning third-party AI
//   off disables immediately without a modal; And Given an authenticated
//   mobile user viewing pending AI category suggestions on Transactions who
//   has not yet seen the AI transparency notice, When the screen renders, Then
//   the AI transparency banner appears once, records seen status on the
//   server, remains visible until explicitly dismissed, and hides on
//   dismissal.
describe("Apple 5.1.2(i) AI consent, EU AI Act notice, and legal links (story 10-7, AC-2, AC-5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    (compassClient.getCompass as jest.Mock).mockResolvedValue({
      objectif: 800000,
      horizonYears: 30,
    });
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    (llmClient.getAiNotice as jest.Mock).mockResolvedValue({ seen: false });
    (llmClient.markAiNotice as jest.Mock).mockResolvedValue({ seen: true });
    (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "fr" });
  });

  it("shows explicit consent modal naming the provider and cancels without calling setOptIn", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderLive(<ParametresScreen />);
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());

    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
    expect(alertSpy).toHaveBeenCalledWith(
      "Activer les modèles IA tiers ?",
      expect.stringContaining("libellés de transaction"),
      expect.any(Array),
    );
    expect(llmClient.setOptIn).not.toHaveBeenCalled();
  });

  it("disables third-party AI immediately without showing a modal", async () => {
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderLive(<ParametresScreen />);
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());

    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", false);
    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(llmClient.setOptIn).toHaveBeenCalledWith({ thirdParty: false }));
  });

  it("renders AI transparency notice when unseen, marks it seen once, and hides on dismiss", async () => {
    await renderLive(<AiTransparencyNotice />);
    expect(await screen.findByTestId("ai-transparency-notice")).toBeTruthy();
    await waitFor(() => expect(llmClient.markAiNotice).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByTestId("ai-transparency-notice")).toBeNull();
  });

  it("opens /privacy, /terms, and /support from Login and Paramètres screens", async () => {
    const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const loginView = await renderLive(<LoginScreen />);
    await fireEvent.press(screen.getByTestId("login-privacy-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    await fireEvent.press(screen.getByTestId("login-terms-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/terms");
    await loginView.unmount();

    openSpy.mockClear();
    await renderLive(<ParametresScreen />);
    await fireEvent.press(screen.getByTestId("settings-privacy-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    await fireEvent.press(screen.getByTestId("settings-terms-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/terms");
    await fireEvent.press(screen.getByTestId("settings-support-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/support");
  });
});

import { PekuloRootProvider } from "@pekulo/ui";
import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert, Linking } from "react-native";

import TransactionsScreen from "../app/(tabs)/transactions/index";
import LoginScreen from "../app/login";
import ParametresScreen from "../app/parametres";
import { AiTransparencyNotice } from "../components/ai-transparency-notice";
import { AuthProvider, createMobileQueryClient } from "../lib/auth/auth-context";
import { I18nProvider, type Lang } from "../lib/i18n";
import {
  accountsClient,
  compassClient,
  llmClient,
  settingsClient,
  transactionsClient,
} from "../lib/orpc/modules";

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
  MockToolbar.Menu = MockToolbar;
  MockToolbar.MenuAction = MockToolbar.Button;
  MockToolbar.Spacer = () => null;
  MockStack.Toolbar = MockToolbar;
  return { __esModule: true, default: MockStack };
});

jest.mock("../lib/orpc/modules", () => {
  const actual = jest.requireActual("../lib/orpc/modules");
  return {
    ...actual,
    accountsClient: { list: jest.fn() },
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
    transactionsClient: {
      monthSummary: jest.fn(),
      listPendingSuggestions: jest.fn(),
      listTransactions: jest.fn(),
      confirmCategorisation: jest.fn(),
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

async function renderLive(
  ui: ReactNode,
  { session = SESSION, lang = "fr" }: { session?: Session | null; lang?: Lang } = {},
) {
  const queryClient = createMobileQueryClient();
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <PekuloRootProvider theme="pekulo-light">
        <I18nProvider lang={lang}>
          <AuthProvider initialSession={session} requireAuth={false}>
            {ui}
          </AuthProvider>
        </I18nProvider>
      </PekuloRootProvider>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
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
  const originalProviderEnv = process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME;
    (accountsClient.list as jest.Mock).mockResolvedValue([]);
    (compassClient.getCompass as jest.Mock).mockResolvedValue({
      objectif: 800000,
      horizonYears: 30,
    });
    (llmClient.getOptIn as jest.Mock).mockResolvedValue({ thirdParty: false });
    (llmClient.setOptIn as jest.Mock).mockResolvedValue({ thirdParty: true });
    (llmClient.getAiNotice as jest.Mock).mockResolvedValue({ seen: false });
    (llmClient.markAiNotice as jest.Mock).mockResolvedValue({ seen: true });
    (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "fr" });
    (transactionsClient.monthSummary as jest.Mock).mockResolvedValue({
      month: "2026-11",
      income: 3000,
      spending: 1200,
      net: 1800,
      count: 1,
    });
    (transactionsClient.listTransactions as jest.Mock).mockResolvedValue({
      items: [],
      nextCursor: null,
      totalCount: 0,
    });
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValue({
      items: [
        {
          id: "tx_1",
          label: "Carrefour Market",
          amount: -45.2,
          type: "depense",
          date: "2026-11-20",
          category: "autre",
          suggestedCategory: "alimentation",
          suggestedConfidence: 0.92,
          suggestedRoute: "ollama",
          accountId: "acc_1",
        },
      ],
      totalCount: 1,
    });
  });

  afterAll(() => {
    if (originalProviderEnv === undefined) {
      delete process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME;
    } else {
      process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME = originalProviderEnv;
    }
  });

  it("shows explicit consent modal naming Mistral AI (or env override) and all disclosed fields, and cancels without calling setOptIn", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const view = await renderLive(<ParametresScreen />);
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());

    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0] as [
      string,
      string,
      Array<{ text?: string; style?: string; onPress?: () => void }>,
    ];
    expect(title).toBe("Activer les modèles IA tiers ?");
    expect(message).toContain("Mistral AI");
    expect(message).toContain("libellés de transaction");
    expect(message).toContain("montants");
    expect(message).toContain("devises");
    expect(message).toContain("dates");
    expect(message).toContain("sans identifiant personnel ni numéro de compte");
    // Cancel reconciles switch without calling setOptIn.
    buttons.find((b) => b.style === "cancel")?.onPress?.();
    expect(llmClient.setOptIn).not.toHaveBeenCalled();
    await view.unmount();

    // Env override names custom provider.
    alertSpy.mockClear();
    process.env.EXPO_PUBLIC_LLM_THIRD_PARTY_PROVIDER_NAME = "Anthropic Claude";
    await renderLive(<ParametresScreen />);
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalledTimes(2));
    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
    expect(alertSpy.mock.calls[0]?.[1]).toContain("Anthropic Claude");
  });

  it("persists opt-in only after confirmation and invalidates the ai-notice query cache", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      const confirm = buttons?.find((b) => b.style !== "cancel");
      confirm?.onPress?.();
    });
    const { queryClient } = await renderLive(<ParametresScreen />);
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    await waitFor(() => expect(llmClient.getOptIn).toHaveBeenCalled());

    await fireEvent(screen.getByTestId("llm-optin-switch"), "valueChange", true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(llmClient.setOptIn).toHaveBeenCalledWith({ thirdParty: true }));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["mobile", "llm", "ai-notice"],
      }),
    );
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

  it("mounts AI transparency notice inside TransactionsScreen when pending suggestions exist and hides when empty or already seen", async () => {
    const viewWithPending = await renderLive(<TransactionsScreen />);
    expect(await screen.findByTestId("ai-transparency-notice")).toBeTruthy();
    await waitFor(() => expect(llmClient.markAiNotice).toHaveBeenCalledTimes(1));
    // Notice remains latched visible after markAiNotice resolves until dismissed.
    expect(screen.getByTestId("ai-transparency-notice")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("ai-transparency-notice-dismiss"));
    expect(screen.queryByTestId("ai-transparency-notice")).toBeNull();
    await viewWithPending.unmount();

    // Empty pending suggestions -> notice not mounted.
    (llmClient.getAiNotice as jest.Mock).mockClear();
    (transactionsClient.listPendingSuggestions as jest.Mock).mockResolvedValueOnce({
      items: [],
      totalCount: 0,
    });
    const viewEmpty = await renderLive(<TransactionsScreen />);
    await waitFor(() => expect(transactionsClient.listPendingSuggestions).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("ai-transparency-notice")).toBeNull();
    await viewEmpty.unmount();
  });

  it("does not infinite-loop when markAiNotice rejects and stays hidden when already seen", async () => {
    (llmClient.markAiNotice as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    const unseenView = await renderLive(<AiTransparencyNotice />);
    expect(await screen.findByTestId("ai-transparency-notice")).toBeTruthy();
    await waitFor(() => expect(llmClient.markAiNotice).toHaveBeenCalledTimes(1));
    await unseenView.unmount();

    (llmClient.getAiNotice as jest.Mock).mockResolvedValueOnce({ seen: true });
    await renderLive(<AiTransparencyNotice />);
    await waitFor(() => expect(llmClient.getAiNotice).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("ai-transparency-notice")).toBeNull();
  });

  it("opens /privacy, /terms, and /support from both Login and Paramètres in FR and EN", async () => {
    const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const loginFr = await renderLive(<LoginScreen />);
    expect(screen.getByText("Politique de confidentialité")).toBeTruthy();
    expect(screen.getByText("Conditions d’utilisation")).toBeTruthy();
    expect(screen.getByText("Assistance")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("login-privacy-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    await fireEvent.press(screen.getByTestId("login-terms-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/terms");
    await fireEvent.press(screen.getByTestId("login-support-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/support");
    await loginFr.unmount();

    // English locale check on both Login and Settings.
    openSpy.mockClear();
    (settingsClient.get as jest.Mock).mockResolvedValue({ theme: "system", lang: "en" });
    const loginEn = await renderLive(<LoginScreen />, { lang: "en" });
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Terms of Service")).toBeTruthy();
    expect(screen.getByText("Support")).toBeTruthy();
    await loginEn.unmount();

    await renderLive(<ParametresScreen />, { lang: "en" });
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Terms of Service & Accessibility")).toBeTruthy();
    expect(screen.getByText("Support")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("settings-privacy-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/privacy");
    await fireEvent.press(screen.getByTestId("settings-terms-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/terms");
    await fireEvent.press(screen.getByTestId("settings-support-link"));
    expect(openSpy).toHaveBeenCalledWith("https://pekulo.app/support");
  });
});

// AC-3 (verbatim from story 9-1-pwa-manifest-and-install:18):
//   Given Android fires `beforeinstallprompt`, or iOS Safari is open and the app
//   is not already installed, When the page loads, Then a dismissible bottom
//   banner appears (an Install button on Android that triggers the native prompt;
//   a "Share -> Add to Home Screen" hint on iOS); the banner is hidden when the
//   app runs in `display-mode: standalone` or once the user dismisses it
//   (dismissal persisted in `localStorage`), and all copy is localised in fr + en.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../test/setup";
import enMessages from "../../messages/en.json";
import { InstallPrompt } from "./install-prompt";

const DISMISS_KEY = "pekulo:install-dismissed";

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile";
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari";

// A faithful beforeinstallprompt: preventDefault-able, prompt() + userChoice with
// a configurable outcome so the accepted/declined branches can both be exercised.
function fireInstallPrompt(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt");
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt };
}

describe("InstallPrompt", () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    setUserAgent(ANDROID_UA);
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it("stays hidden until an install signal arrives", () => {
    renderWithTamagui(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the Android install banner when beforeinstallprompt fires", async () => {
    renderWithTamagui(<InstallPrompt />);
    fireInstallPrompt("accepted");
    const banner = await screen.findByRole("dialog");
    expect(banner).toHaveAccessibleName("Installer Pekulo");
    expect(screen.getByRole("button", { name: "Installer" })).toBeInTheDocument();
  });

  it("triggers the native prompt, persists, and hides when Install is accepted", async () => {
    renderWithTamagui(<InstallPrompt />);
    const { prompt } = fireInstallPrompt("accepted");
    fireEvent.click(await screen.findByRole("button", { name: "Installer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("does NOT persist dismissal when the OS prompt is declined", async () => {
    renderWithTamagui(<InstallPrompt />);
    const { prompt } = fireInstallPrompt("dismissed");
    fireEvent.click(await screen.findByRole("button", { name: "Installer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(prompt).toHaveBeenCalledTimes(1);
    // Declined install must be re-offerable on a later visit — flag NOT persisted.
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("shows the iOS hint (no install button) on iPhone Safari", async () => {
    setUserAgent(IOS_UA);
    renderWithTamagui(<InstallPrompt />);
    const banner = await screen.findByRole("dialog");
    expect(banner).toHaveTextContent("Sur l'écran d'accueil");
    expect(screen.queryByRole("button", { name: "Installer" })).toBeNull();
  });

  it("persists dismissal and hides when the close button is clicked", async () => {
    setUserAgent(IOS_UA);
    renderWithTamagui(<InstallPrompt />);
    fireEvent.click(await screen.findByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("stays hidden once dismissed (persisted in localStorage)", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setUserAgent(IOS_UA);
    renderWithTamagui(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays hidden when the app already runs in display-mode: standalone", () => {
    setUserAgent(IOS_UA);
    // Report the app as installed (standalone) — the one branch AC-3 gates on.
    window.matchMedia = ((query: string) => ({
      matches: /display-mode: standalone/.test(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    renderWithTamagui(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders English copy under the en locale", async () => {
    setUserAgent(IOS_UA);
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InstallPrompt />
      </NextIntlClientProvider>,
    );
    const banner = await screen.findByRole("dialog");
    expect(banner).toHaveAccessibleName("Install Pekulo");
    expect(banner).toHaveTextContent("Add to Home Screen");
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("has no axe violations (iOS hint variant)", async () => {
    setUserAgent(IOS_UA);
    const { container } = renderWithTamagui(<InstallPrompt />);
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });
});

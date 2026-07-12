import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../test/setup";
import { InstallPrompt } from "./install-prompt";

function setUserAgent(ua: string): void {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile";
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari";

describe("InstallPrompt", () => {
  beforeEach(() => {
    localStorage.clear();
    setUserAgent(ANDROID_UA);
  });

  it("stays hidden until an install signal arrives", () => {
    renderWithTamagui(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the Android install banner when beforeinstallprompt fires", async () => {
    renderWithTamagui(<InstallPrompt />);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    const banner = await screen.findByRole("dialog");
    expect(banner).toHaveAccessibleName("Installer Pekulo");
    expect(screen.getByRole("button", { name: "Installer" })).toBeInTheDocument();
  });

  it("shows the iOS hint (no install button) on iPhone Safari", async () => {
    setUserAgent(IOS_UA);
    renderWithTamagui(<InstallPrompt />);
    const banner = await screen.findByRole("dialog");
    expect(banner).toHaveTextContent("Sur l'écran d'accueil");
    expect(screen.queryByRole("button", { name: "Installer" })).toBeNull();
  });

  it("stays hidden once dismissed (persisted in localStorage)", () => {
    localStorage.setItem("pekulo:install-dismissed", "1");
    setUserAgent(IOS_UA);
    renderWithTamagui(<InstallPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no axe violations (iOS hint variant)", async () => {
    setUserAgent(IOS_UA);
    const { container } = renderWithTamagui(<InstallPrompt />);
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });
});

// AC-6 — "a banner states the offline mode and the age in minutes of the
// displayed snapshot, localised in fr + en, carrying the font_body class."
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import { dashboardKeys } from "@/lib/zapaction/keys";
import frMessages from "../../messages/fr.json";
import enMessages from "../../messages/en.json";
import { OfflineBanner } from "./offline-banner";

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function renderBanner(locale: "fr" | "en", client: QueryClient) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages}>
      <QueryClientProvider client={client}>
        <OfflineBanner />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  setOnline(true);
});

describe("OfflineBanner (story 9-2)", () => {
  it("renders nothing while online", () => {
    renderBanner("fr", client);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("AC-6 — appears when the browser goes offline", async () => {
    renderBanner("fr", client);
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    const banner = await screen.findByRole("status");
    expect(banner).toHaveAccessibleName("Mode hors ligne");
    expect(banner.className).toContain("font_body");
  });

  it("AC-6 — reports the snapshot age in minutes", async () => {
    client.setQueryData(dashboardKeys.overview(), { netWorth: 1 });
    const state = client.getQueryState(dashboardKeys.overview());
    vi.spyOn(Date, "now").mockReturnValue((state?.dataUpdatedAt ?? 0) + 7 * 60_000);
    setOnline(false);
    renderBanner("fr", client);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("il y a 7 min");
  });

  it("AC-6 — falls back to the age-less copy with no snapshot", async () => {
    setOnline(false);
    renderBanner("fr", client);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("lecture seule");
    expect(banner).not.toHaveTextContent("il y a");
  });

  it("AC-6 — renders the en catalog", async () => {
    setOnline(false);
    renderBanner("en", client);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("read-only");
    expect(banner).toHaveAccessibleName("Offline mode");
  });

  it("disappears again when connectivity returns", async () => {
    setOnline(false);
    renderBanner("fr", client);
    await screen.findByRole("status");
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("has no axe violations", async () => {
    setOnline(false);
    const { container } = renderBanner("fr", client);
    await screen.findByRole("status");
    expect(await axe(container)).toHaveNoViolations();
  });
});

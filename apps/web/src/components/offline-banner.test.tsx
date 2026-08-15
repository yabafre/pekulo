// AC-6 — "a banner states the offline mode and the age in minutes of the
// displayed snapshot, localised in fr + en, carrying the font_body class."
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("next/navigation", () => ({ usePathname }));

import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import { dashboardKeys } from "@/lib/zapaction/keys";
import frMessages from "../../messages/fr.json";
import enMessages from "../../messages/en.json";
import {
  OFFLINE_BANNER_OFFSET_VAR,
  OFFLINE_BANNER_OPEN_CLASS,
  OfflineBanner,
} from "./offline-banner";

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
  usePathname.mockReturnValue("/dashboard");
  setOnline(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  setOnline(true);
  document.documentElement.classList.remove(OFFLINE_BANNER_OPEN_CLASS);
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

  /** Seed a snapshot, then hand back a knob that moves the wall clock forward
   * without touching react-query's recorded `dataUpdatedAt`. Only the timer
   * functions are faked — faking `Date` too would zero the stamp. */
  function seedSnapshotWithClock(): (ms: number) => Promise<void> {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    client.setQueryData(dashboardKeys.overview(), { netWorth: 1 });
    const updatedAt = client.getQueryState(dashboardKeys.overview())?.dataUpdatedAt ?? 0;
    let elapsed = 0;
    vi.spyOn(Date, "now").mockImplementation(() => updatedAt + elapsed);
    return async (ms: number) => {
      elapsed += ms;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    };
  }

  it("AC-6 — the age keeps counting up while the tab stays offline", async () => {
    // `Date.now()` was read in the render body with nothing to re-trigger it, so
    // a user sitting on /dashboard for 45 minutes still read "il y a 2 min".
    const advance = seedSnapshotWithClock();
    setOnline(false);
    renderBanner("fr", client);
    expect((await screen.findByRole("status")).textContent).toContain("0 min");

    await advance(5 * 60_000);
    expect(screen.getByRole("status").textContent).toContain("5 min");
    vi.useRealTimers();
  });

  it("AC-3 — past the 60-minute ceiling the banner stops claiming usable figures", async () => {
    // NFR-20 caps the snapshot at 60 minutes, but the ceiling was enforced only
    // on the RESTORE path — a tab left open offline kept displaying figures
    // indefinitely, under a label that understated their age.
    const advance = seedSnapshotWithClock();
    setOnline(false);
    renderBanner("fr", client);
    await screen.findByRole("status");

    await advance(61 * 60_000);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toBe(frMessages.offline.expired);
    expect(text).not.toContain("61 min");
    vi.useRealTimers();
  });

  it("paints the band it opens, instead of exposing the browser canvas", async () => {
    // Offsetting `body` pushes the only opaque surface (.shell, #000) down, and
    // `html`/`body` are both rgba(0,0,0,0) — so in the dark theme the band read
    // as a 62px PURE WHITE stripe across the whole viewport, banner floating in
    // it. Measured live at 1280 and 375: seam contrast 21:1.
    setOnline(false);
    const { container } = renderBanner("fr", client);
    await screen.findByRole("status");
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain("background: var(--background)");
  });

  it("sizes the page offset from the banner, not from a constant", async () => {
    // A hardcoded 62px was measured against the ENGLISH one-line copy. In fr at
    // 375 the copy wraps to two lines (bottom 64 > header top 62) and the banner
    // overlaps the header. Any longer locale or larger user font size does the
    // same, so the offset has to follow the element.
    setOnline(false);
    renderBanner("fr", client);
    await screen.findByRole("status");
    expect(document.documentElement.style.getPropertyValue(OFFLINE_BANNER_OFFSET_VAR)).not.toBe("");
  });

  it("has no axe violations", async () => {
    setOnline(false);
    const { container } = renderBanner("fr", client);
    await screen.findByRole("status");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("stays silent on routes the offline cache does not cover", () => {
    // The component mounts in the ROOT layout, so it renders on every screen —
    // but only three are cached. Announcing "read-only data" on /login or
    // /dashboard/transactions describes a state that does not exist there.
    setOnline(false);
    usePathname.mockReturnValue("/dashboard/transactions");
    renderBanner("fr", client);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("stays silent on the signed-out screens", () => {
    setOnline(false);
    usePathname.mockReturnValue("/login");
    renderBanner("fr", client);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offsets the page while open so it never covers the app header", async () => {
    // The cap-shell header is a normal flow element (bento.module.css .header),
    // and the banner is position:fixed. Without this offset the banner sits ON
    // TOP of the header — measured on a 390px viewport it covered the Cap /
    // Patrimoine tabs and every header button.
    setOnline(false);
    renderBanner("fr", client);
    await screen.findByRole("status");
    expect(document.documentElement.classList.contains(OFFLINE_BANNER_OPEN_CLASS)).toBe(true);
  });

  it("removes the page offset when connectivity returns", async () => {
    setOnline(false);
    renderBanner("fr", client);
    await screen.findByRole("status");
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(document.documentElement.classList.contains(OFFLINE_BANNER_OPEN_CLASS)).toBe(false);
  });
});

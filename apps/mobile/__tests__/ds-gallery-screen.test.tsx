// apps/mobile/__tests__/ds-gallery-screen.test.tsx
// Story 10-5 AC-4 — DS gallery route behaviour.
//
// AC-4 (verbatim from story 10-5-mobile-parity-and-maestro:19):
//   Given a mobile build made with `EXPO_PUBLIC_DS_GALLERY=1`, When the deep
//   link `pekulo://ds/<caseId>?theme=<pekulo-dark|pekulo-light>` opens, Then
//   the app shows that catalog case alone, in the requested theme (dark by
//   default), inside a container identified as `ds-case-<caseId>`; And when the
//   flag is not `1` or the case id is unknown, the app returns to its home
//   screen instead.
import { PekuloRootProvider, pekuloColors } from "@pekulo/ui";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import DsGalleryCaseScreen from "../app/ds/[case]";
import { isDsGalleryEnabled, resolveGalleryTheme } from "../lib/ds-gallery";

const mockParams: { case?: string | string[]; theme?: string | string[] } = {};

jest.mock("expo-router", () => {
  const { createElement } = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => createElement(Text, null, `redirect:${href}`),
  };
});

const originalGalleryFlag = process.env.EXPO_PUBLIC_DS_GALLERY;

async function renderScreen(): Promise<void> {
  await render(
    <PekuloRootProvider theme="pekulo-dark">
      <DsGalleryCaseScreen />
    </PekuloRootProvider>,
  );
}

beforeEach(() => {
  mockParams.case = undefined;
  mockParams.theme = undefined;
  process.env.EXPO_PUBLIC_DS_GALLERY = "1";
});

afterEach(() => {
  if (originalGalleryFlag === undefined) {
    delete process.env.EXPO_PUBLIC_DS_GALLERY;
  } else {
    process.env.EXPO_PUBLIC_DS_GALLERY = originalGalleryFlag;
  }
});

describe("DS gallery route (story 10-5, AC-4)", () => {
  it("renders the requested parity case in the requested light theme", async () => {
    mockParams.case = "PekuloStat.gain";
    mockParams.theme = "pekulo-light";
    await renderScreen();
    const container = screen.getByTestId("ds-case-PekuloStat.gain");
    const containerStyle = StyleSheet.flatten(container.props.style);
    const valueStyle = StyleSheet.flatten(screen.getByText("+1 050 €").props.style);
    expect(containerStyle.backgroundColor).toBe(pekuloColors.light.surface.bg);
    expect(valueStyle.color).toBe(pekuloColors.light.perf.gain);
    expect(screen.getByText("Net")).toBeTruthy();
  });

  it("defaults to the dark theme when theme param is omitted", async () => {
    mockParams.case = "PekuloStat.gain";
    await renderScreen();
    const container = screen.getByTestId("ds-case-PekuloStat.gain");
    const containerStyle = StyleSheet.flatten(container.props.style);
    const valueStyle = StyleSheet.flatten(screen.getByText("+1 050 €").props.style);
    expect(containerStyle.backgroundColor).toBe(pekuloColors.dark.surface.bg);
    expect(valueStyle.color).toBe(pekuloColors.dark.perf.gain);
  });

  it("redirects home for an unknown or non-string case id", async () => {
    mockParams.case = "PekuloStat.nope";
    await renderScreen();
    expect(screen.getByText("redirect:/")).toBeTruthy();

    mockParams.case = ["PekuloStat.gain"];
    await renderScreen();
    expect(screen.getByText("redirect:/")).toBeTruthy();
  });

  it("redirects home when EXPO_PUBLIC_DS_GALLERY is not 1", async () => {
    delete process.env.EXPO_PUBLIC_DS_GALLERY;
    mockParams.case = "PekuloStat.gain";
    await renderScreen();
    expect(screen.getByText("redirect:/")).toBeTruthy();
    expect(screen.queryByTestId("ds-case-PekuloStat.gain")).toBeNull();
  });

  it("enables the gallery only for EXPO_PUBLIC_DS_GALLERY=1 and defaults to the dark theme", () => {
    expect(isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "1" })).toBe(true);
    expect(isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: " 1 " })).toBe(true);
    expect(isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "true" })).toBe(false);
    expect(isDsGalleryEnabled({})).toBe(false);
    expect(resolveGalleryTheme("pekulo-light")).toBe("pekulo-light");
    expect(resolveGalleryTheme("pekulo-dark")).toBe("pekulo-dark");
    expect(resolveGalleryTheme(undefined)).toBe("pekulo-dark");
    expect(resolveGalleryTheme(["pekulo-light"])).toBe("pekulo-dark");
  });
});

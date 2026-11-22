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
import { PekuloRootProvider } from "@pekulo/ui";
import { render, screen } from "@testing-library/react-native";

import DsGalleryCaseScreen from "../app/ds/[case]";
import { isDsGalleryEnabled } from "../lib/ds-gallery";

const mockParams: { case?: string; theme?: string } = {};

jest.mock("expo-router", () => {
  const { createElement } = require("react") as typeof import("react");
  const { Text } = require("react-native") as typeof import("react-native");
  return {
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => createElement(Text, null, `redirect:${href}`),
  };
});

jest.mock("../lib/ds-gallery", () => ({
  ...jest.requireActual("../lib/ds-gallery"),
  isDsGalleryEnabled: jest.fn(() => true),
}));

const actualGallery = jest.requireActual<typeof import("../lib/ds-gallery")>("../lib/ds-gallery");

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
  (isDsGalleryEnabled as jest.Mock).mockReturnValue(true);
});

describe("DS gallery route (story 10-5, AC-4)", () => {
  it("renders the requested parity case inside its cropOn container", async () => {
    mockParams.case = "PekuloStat.gain";
    mockParams.theme = "pekulo-light";
    await renderScreen();
    expect(screen.getByTestId("ds-case-PekuloStat.gain")).toBeTruthy();
    expect(screen.getByText("Net")).toBeTruthy();
    expect(screen.getByText("+1 050 €")).toBeTruthy();
  });

  it("redirects home for an unknown case id", async () => {
    mockParams.case = "PekuloStat.nope";
    await renderScreen();
    expect(screen.getByText("redirect:/")).toBeTruthy();
  });

  it("redirects home when the gallery is disabled", async () => {
    (isDsGalleryEnabled as jest.Mock).mockReturnValue(false);
    mockParams.case = "PekuloStat.gain";
    await renderScreen();
    expect(screen.getByText("redirect:/")).toBeTruthy();
    expect(screen.queryByTestId("ds-case-PekuloStat.gain")).toBeNull();
  });

  it("enables the gallery only for EXPO_PUBLIC_DS_GALLERY=1 and defaults to the dark theme", () => {
    expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "1" })).toBe(true);
    expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: " 1 " })).toBe(true);
    expect(actualGallery.isDsGalleryEnabled({ EXPO_PUBLIC_DS_GALLERY: "true" })).toBe(false);
    expect(actualGallery.isDsGalleryEnabled({})).toBe(false);
    expect(actualGallery.resolveGalleryTheme("pekulo-light")).toBe("pekulo-light");
    expect(actualGallery.resolveGalleryTheme("pekulo-dark")).toBe("pekulo-dark");
    expect(actualGallery.resolveGalleryTheme(undefined)).toBe("pekulo-dark");
    expect(actualGallery.resolveGalleryTheme(["pekulo-light"])).toBe("pekulo-dark");
  });
});

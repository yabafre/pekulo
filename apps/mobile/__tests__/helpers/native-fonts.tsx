// apps/mobile/__tests__/helpers/native-fonts.tsx
// Story 10-8 AC-1/AC-2/AC-3 — one assertion set shared by the `ios` and
// `android` Jest projects. Renders DS text through every resolution path:
//   - bare Tamagui Text (runtime defaultProps path),
//   - PekuloHero (compiler-flattened path — only meaningful with a cold
//     transform cache: run with `--no-cache`),
//   - PekuloBreadcrumbLink (named styled(Text), bypasses defaultProps.Text),
//   - PekuloInput / PekuloTextarea / SearchField (raw RN TextInput).
//
// AC-1 (verbatim from story 10-8-native-geist-font:27):
//   Given the mobile app running natively (iOS or Android), When any
//   `@pekulo/ui` text renders — whether the Tamagui optimizing compiler
//   flattened it at build time or Tamagui resolved it at runtime — Then its
//   style carries a Geist face name matching its weight (`Geist_400Regular` for
//   no weight / 400, `Geist_500Medium` for 500, `Geist_600SemiBold` for 600,
//   `Geist_700Bold` for 700; `$heading` without weight → `Geist_600SemiBold`;
//   `$mono` → `GeistMono_<weight>`), And that style carries no `fontWeight`
//   alongside the custom face (a custom `fontFamily` + `fontWeight` pair makes
//   Android fall back to the system font).
// AC-2 (verbatim from story 10-8-native-geist-font:28):
//   Given the native DS text inputs (single-line and multi-line), the native
//   breadcrumb link, and the app's transaction search field, When they render,
//   Then their text resolves to `Geist_400Regular`.
// AC-3 (verbatim from story 10-8-native-geist-font:29):
//   Given the mobile unit test suite, When it runs for iOS and for Android with
//   a cold transform cache, Then the same assertions prove AC-1 and AC-2 on
//   both, And the suite fails if the build-time style compiler stops using the
//   native font configuration or if the build-time and runtime configurations
//   ever disagree on fonts or text defaults.
import {
  PekuloBreadcrumbLink,
  PekuloHero,
  PekuloInput,
  PekuloRootProvider,
  PekuloTextarea,
} from "@pekulo/ui";
import { Text } from "@pekulo/ui/client";
import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SearchField } from "@/components/search-field";

type HostNode = {
  type: string;
  props: Record<string, unknown>;
  children: Array<HostNode | string> | null;
};

export type NativeFontRecord = {
  type: string;
  testID: string | undefined;
  text: string;
  fontFamily: unknown;
  fontWeight: unknown;
};

export const GEIST_FACES = new Set([
  "Geist_400Regular",
  "Geist_500Medium",
  "Geist_600SemiBold",
  "Geist_700Bold",
  "GeistMono_400Regular",
  "GeistMono_500Medium",
  "GeistMono_600SemiBold",
  "GeistMono_700Bold",
]);

function collect(node: HostNode | HostNode[] | string | null, out: NativeFontRecord[]): void {
  if (node === null || typeof node === "string") return;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return;
  }
  if (node.type === "Text" || node.type === "TextInput") {
    const style = (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
    out.push({
      type: node.type,
      testID: node.props.testID as string | undefined,
      text: (node.children ?? []).filter((c): c is string => typeof c === "string").join(""),
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
    });
  }
  for (const child of node.children ?? []) collect(child, out);
}

export async function renderNativeFontCases(): Promise<NativeFontRecord[]> {
  const view = await render(
    <PekuloRootProvider>
      <Text testID="t-default">default</Text>
      <Text testID="t-400" fontWeight="400">
        w400
      </Text>
      <Text testID="t-500" fontWeight="500">
        w500
      </Text>
      <Text testID="t-600" fontWeight="600">
        w600
      </Text>
      <Text testID="t-700" fontWeight="700">
        w700
      </Text>
      <Text testID="t-heading" fontFamily="$heading">
        heading
      </Text>
      <Text testID="t-mono-700" fontFamily="$mono" fontWeight="700">
        mono700
      </Text>
      <PekuloHero totalEur={152340} aheadEur={4200} />
      <PekuloBreadcrumbLink testID="t-crumb">crumb</PekuloBreadcrumbLink>
      <PekuloInput testID="t-input" placeholder="input" />
      <PekuloTextarea testID="t-textarea" placeholder="textarea" />
      <SearchField testID="t-search" value="" onChange={() => {}} placeholder="search" />
    </PekuloRootProvider>,
  );
  const out: NativeFontRecord[] = [];
  collect(view.toJSON() as HostNode | HostNode[] | null, out);
  await view.unmount();
  return out;
}

export const EXPECTED_FACE_BY_TEST_ID: Record<string, string> = {
  "t-default": "Geist_400Regular",
  "t-400": "Geist_400Regular",
  "t-500": "Geist_500Medium",
  "t-600": "Geist_600SemiBold",
  "t-700": "Geist_700Bold",
  "t-heading": "Geist_600SemiBold",
  "t-mono-700": "GeistMono_700Bold",
  "t-crumb": "Geist_400Regular",
  "t-input": "Geist_400Regular",
  "t-textarea": "Geist_400Regular",
  "t-search": "Geist_400Regular",
};

export function describeNativeFonts(platformLabel: string): void {
  describe(`@pekulo/ui native Geist faces on ${platformLabel} (story 10-8)`, () => {
    let records: NativeFontRecord[] = [];

    beforeAll(async () => {
      records = await renderNativeFontCases();
    });

    it.each(Object.entries(EXPECTED_FACE_BY_TEST_ID))("%s resolves to %s", (testID, face) => {
      const record = records.find((r) => r.testID === testID);
      expect(record).toBeDefined();
      expect(record?.fontFamily).toBe(face);
    });

    it("never pairs a custom Geist face with a fontWeight (Android fallback trap)", () => {
      const offenders = records.filter((r) => r.fontWeight !== undefined);
      expect(offenders).toEqual([]);
    });

    it("renders every text node — including compiler-flattened PekuloHero text — in a Geist face", () => {
      const offenders = records.filter(
        (r) => typeof r.fontFamily !== "string" || !GEIST_FACES.has(r.fontFamily),
      );
      expect(offenders).toEqual([]);
      expect(
        records.some((r) => r.testID === undefined && r.fontFamily === "Geist_600SemiBold"),
      ).toBe(true);
    });
  });
}

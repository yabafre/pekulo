// apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts
// Story 10-5 AC-5 / story 10-6 AC-7 — the DS gallery Maestro flows are
// GENERATED from PARITY_CASES (one step block per golden case):
//   - apps/mobile/.maestro/flows/ds-gallery.yaml          (iOS, byte-identical to 10-5)
//   - apps/mobile/.maestro/flows/ds-gallery-android.yaml  (Android, tag `android-only`)
// This test fails when a committed flow drifts from the catalog. Regenerate both with:
//   cd apps/mobile && UPDATE_DS_FLOW=1 bunx jest --selectProjects ios __tests__/maestro-ds-gallery-flow.test.ts
//
// AC-5 (verbatim from story 10-5-mobile-parity-and-maestro:20):
//   Given the iOS Simulator end-to-end build running in preview mode with no
//   backend, When the Maestro suite runs, Then the five tabs show their preview
//   figures, Paramètres opens from the Cap header and closes, a mutation
//   attempted in preview mode shows the "Mode aperçu" sign-in prompt and can be
//   dismissed, and every component's golden case matches its committed iOS
//   screenshot at a 98 % similarity threshold — or is captured as a fresh
//   screenshot when golden regeneration is requested; And the mobile test suite
//   fails when the committed screenshot flow no longer matches the golden cases
//   of the catalog.
//
// AC-7 (verbatim from story 10-6-android-parity-and-maestro):
//   Given the Android end-to-end APK on an emulator in preview mode with no
//   backend, When the Maestro suite runs, Then the smoke, navigation (Paramètres
//   dismissed by back on Android, by swipe on iOS), preview-guard, and Android DS
//   gallery flows pass, every component's golden case matching its committed
//   Android screenshot at a 98 % similarity threshold — or being captured fresh
//   when golden regeneration is requested; And the mobile test suite fails when
//   either committed gallery flow (iOS, unchanged from 10-5, or Android) drifts
//   from the parity catalog.
//
// Golden mode: MAESTRO_UPDATE_GOLDENS=true → takeScreenshot (artifacts),
// otherwise assertScreenshot against apps/mobile/.maestro/goldens/<platform>/.
import { PARITY_CASES } from "@pekulo/ui/parity";

const { readFileSync, writeFileSync } = require("node:fs") as {
  readFileSync: (filePath: string, encoding: "utf8") => string;
  writeFileSync: (filePath: string, data: string) => void;
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  resolve: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
const UPDATE_GOLDENS =
  "${typeof MAESTRO_UPDATE_GOLDENS !== 'undefined' && MAESTRO_UPDATE_GOLDENS === 'true'}";
const ASSERT_GOLDENS =
  "${typeof MAESTRO_UPDATE_GOLDENS === 'undefined' || MAESTRO_UPDATE_GOLDENS !== 'true'}";

type GalleryPlatform = "ios" | "android";

interface GalleryFlowSpec {
  /** Flow file, relative to apps/mobile. */
  file: string;
  headerComment: string;
  name: string;
  tags: string[];
  /** takeScreenshot `path` is relative to Maestro's artifact output. */
  capturePrefix: string;
  /** assertScreenshot `path` is resolved from the flow file. */
  assertPrefix: string;
  /** iOS asks "Open in Pekulo?" for a custom-scheme openLink; Android does not. */
  dismissOpenPrompt: boolean;
  /** testID to wait for after the cold launch, before the first openLink. */
  readyId?: string;
}

const FLOWS: Record<GalleryPlatform, GalleryFlowSpec> = {
  ios: {
    file: ".maestro/flows/ds-gallery.yaml",
    headerComment: "# Story 10-5 AC-5 — one iOS screenshot golden per @pekulo/ui component.",
    name: "DS gallery — iOS goldens",
    tags: ["ds-gallery"],
    capturePrefix: "goldens/ios/",
    assertPrefix: "../goldens/ios/",
    dismissOpenPrompt: true,
  },
  android: {
    file: ".maestro/flows/ds-gallery-android.yaml",
    headerComment: "# Story 10-6 AC-7 — one Android screenshot golden per @pekulo/ui component.",
    name: "DS gallery — Android goldens",
    tags: ["ds-gallery-android", "android-only"],
    capturePrefix: "goldens/android/",
    assertPrefix: "../goldens/android/",
    dismissOpenPrompt: false,
    readyId: "tab-cap",
  },
};

function caseSteps(id: string, spec: GalleryFlowSpec): string[] {
  return [
    `- openLink: "pekulo://ds/${id}?theme=pekulo-dark"`,
    ...(spec.dismissOpenPrompt
      ? [
          "- runFlow:",
          "    when:",
          '      visible: "Open"',
          "    commands:",
          '      - tapOn: "Open"',
        ]
      : []),
    "- extendedWaitUntil:",
    "    visible:",
    `      id: "ds-case-${id}"`,
    "    timeout: 15000",
    "- waitForAnimationToEnd:",
    "    timeout: 5000",
    "- runFlow:",
    "    when:",
    `      true: ${UPDATE_GOLDENS}`,
    "    commands:",
    "      - takeScreenshot:",
    `          path: "${spec.capturePrefix}${id}"`,
    "          cropOn:",
    `            id: "ds-case-${id}"`,
    "- runFlow:",
    "    when:",
    `      true: ${ASSERT_GOLDENS}`,
    "    commands:",
    "      - assertScreenshot:",
    `          path: "${spec.assertPrefix}${id}.png"`,
    "          cropOn:",
    `            id: "ds-case-${id}"`,
    "          thresholdPercentage: 98",
  ];
}

function buildDsGalleryFlow(spec: GalleryFlowSpec): string {
  const goldenIds = PARITY_CASES.filter((c) => c.golden).map((c) => c.id);
  const lines = [
    "# GENERATED by apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts — do not edit.",
    spec.headerComment,
    "appId: app.pekulo.mobile",
    `name: ${spec.name}`,
    "tags:",
    ...spec.tags.map((tag) => `  - ${tag}`),
    "---",
    "- launchApp:",
    "    clearState: true",
    ...(spec.readyId
      ? [
          "- extendedWaitUntil:",
          "    visible:",
          `      id: "${spec.readyId}"`,
          "    timeout: 30000",
        ]
      : []),
    ...goldenIds.flatMap((id) => caseSteps(id, spec)),
  ];
  return `${lines.join("\n")}\n`;
}

describe.each(["ios", "android"] as const)(
  "Maestro ds-gallery flow — %s (stories 10-5 AC-5, 10-6 AC-7)",
  (platform) => {
    const spec = FLOWS[platform];
    const flowPath = path.resolve(MOBILE_ROOT, spec.file);

    it("is generated from PARITY_CASES and committed up to date", () => {
      const expected = buildDsGalleryFlow(spec);
      if (process.env.UPDATE_DS_FLOW === "1") writeFileSync(flowPath, expected);
      expect(readFileSync(flowPath, "utf8")).toBe(expected);
    });

    it("captures exactly one golden per component", () => {
      const goldenCount = PARITY_CASES.filter((c) => c.golden).length;
      const components = new Set(PARITY_CASES.map((c) => c.component)).size;
      expect(goldenCount).toBe(components);
      expect(buildDsGalleryFlow(spec).match(/- assertScreenshot:/g)?.length).toBe(goldenCount);
    });
  },
);

// Story 10-6 AC-7 — on Android an `openLink` fired right after a cold
// `launchApp` reaches the activity before React Native registers its Linking
// listener and is dropped (EAS run 2026-11-25: the emulator stayed on the tabs).
// The Android flow must wait for the app shell before the first deep link.
it("Android gallery flow waits for the tab bar before the first deep link", () => {
  const flow = readFileSync(path.resolve(MOBILE_ROOT, FLOWS.android.file), "utf8");
  const ready = flow.indexOf('id: "tab-cap"');
  expect(ready).toBeGreaterThan(-1);
  expect(ready).toBeLessThan(flow.indexOf("- openLink:"));
});

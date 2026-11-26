// apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts
// Story 10-5 AC-5 / story 10-6 AC-7 — the DS gallery Maestro flows are
// GENERATED from PARITY_CASES, per platform, split into SHARD_COUNT shards:
//   - apps/mobile/.maestro/gallery/ios/shard-<n>.yaml
//   - apps/mobile/.maestro/gallery/android/shard-<n>.yaml
// Each golden case is wrapped in a Maestro `retry` so a flake re-runs that case
// only, and each shard runs in its own CI job (.github/workflows/e2e-mobile.yml),
// so a failing shard is retried alone. The gallery lives outside `flows/`, so
// `maestro test apps/mobile/.maestro` runs only smoke / navigation / preview-guard.
// This test fails when a committed shard drifts from the catalog. Regenerate with:
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

export {};

const fs = require("node:fs") as {
  existsSync: (filePath: string) => boolean;
  mkdirSync: (dir: string, options: { recursive: boolean }) => void;
  readdirSync: (dir: string) => string[];
  readFileSync: (filePath: string, encoding: "utf8") => string;
  rmSync: (filePath: string) => void;
  writeFileSync: (filePath: string, data: string) => void;
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
  resolve: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
const REPO_ROOT = path.resolve(MOBILE_ROOT, "../..");
const E2E_WORKFLOW = path.join(REPO_ROOT, ".github/workflows/e2e-mobile.yml");

/** Gallery shards per platform — mirrored by the `shard` matrix of e2e-mobile.yml. */
const SHARD_COUNT = 4;

const UPDATE_GOLDENS =
  "${typeof MAESTRO_UPDATE_GOLDENS !== 'undefined' && MAESTRO_UPDATE_GOLDENS === 'true'}";
const ASSERT_GOLDENS =
  "${typeof MAESTRO_UPDATE_GOLDENS === 'undefined' || MAESTRO_UPDATE_GOLDENS !== 'true'}";

type GalleryPlatform = "ios" | "android";

interface GalleryFlowSpec {
  /** Shard directory, relative to apps/mobile. */
  dir: string;
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
    dir: ".maestro/gallery/ios",
    headerComment: "# Story 10-5 AC-5 — iOS screenshot goldens, one per @pekulo/ui component.",
    name: "DS gallery — iOS goldens",
    tags: ["ds-gallery", "ios-only"],
    capturePrefix: "goldens/ios/",
    assertPrefix: "../../goldens/ios/",
    dismissOpenPrompt: true,
  },
  android: {
    dir: ".maestro/gallery/android",
    headerComment: "# Story 10-6 AC-7 — Android screenshot goldens, one per @pekulo/ui component.",
    name: "DS gallery — Android goldens",
    tags: ["ds-gallery", "android-only"],
    capturePrefix: "goldens/android/",
    assertPrefix: "../../goldens/android/",
    dismissOpenPrompt: false,
    // An openLink fired right after a cold launchApp reaches the activity before
    // React Native registers its Linking listener and is dropped (EAS run
    // 2026-11-25: the emulator stayed on the tabs).
    readyId: "tab-cap",
  },
};

const GOLDEN_IDS = PARITY_CASES.filter((c) => c.golden).map((c) => c.id);

/** Contiguous, balanced split: 42 cases → 11 / 11 / 10 / 10. */
function shardIds(shard: number): string[] {
  const base = Math.floor(GOLDEN_IDS.length / SHARD_COUNT);
  const extra = GOLDEN_IDS.length % SHARD_COUNT;
  const start = (shard - 1) * base + Math.min(shard - 1, extra);
  const size = base + (shard <= extra ? 1 : 0);
  return GOLDEN_IDS.slice(start, start + size);
}

/** Reach case `id`: the shard's first case by deep link, the others via `ds-next`. */
function navigateSteps(id: string, spec: GalleryFlowSpec, first: boolean): string[] {
  const navigation = first
    ? [
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
      ]
    : ["- tapOn:", '    id: "ds-next"'];
  // Only when the target is not already on screen: a retry never advances twice.
  return [
    "- runFlow:",
    "    when:",
    "      notVisible:",
    `        id: "ds-case-${id}"`,
    "    commands:",
    ...navigation.map((line) => `      ${line}`),
  ];
}

function caseSteps(id: string, spec: GalleryFlowSpec, first: boolean): string[] {
  const commands = [
    ...navigateSteps(id, spec, first),
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
  // One retry per case: a flake re-runs this case only, not the whole shard.
  return [
    "- retry:",
    "    maxRetries: 1",
    "    commands:",
    ...commands.map((line) => `      ${line}`),
  ];
}

function buildShardFlow(spec: GalleryFlowSpec, shard: number): string {
  const lines = [
    "# GENERATED by apps/mobile/__tests__/maestro-ds-gallery-flow.test.ts — do not edit.",
    spec.headerComment,
    `# Shard ${shard}/${SHARD_COUNT}.`,
    "appId: app.pekulo.mobile",
    `name: ${spec.name} (shard ${shard}/${SHARD_COUNT})`,
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
    ...shardIds(shard).flatMap((id, index) => caseSteps(id, spec, index === 0)),
  ];
  return `${lines.join("\n")}\n`;
}

const SHARDS = Array.from({ length: SHARD_COUNT }, (_, index) => index + 1);

describe.each(["ios", "android"] as const)(
  "Maestro ds-gallery shards — %s (stories 10-5 AC-5, 10-6 AC-7)",
  (platform) => {
    const spec = FLOWS[platform];
    const dir = path.resolve(MOBILE_ROOT, spec.dir);
    const shardPath = (shard: number) => path.join(dir, `shard-${shard}.yaml`);

    it("commits exactly the generated shards, up to date with PARITY_CASES", () => {
      if (process.env.UPDATE_DS_FLOW === "1") {
        fs.mkdirSync(dir, { recursive: true });
        for (const file of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
          fs.rmSync(path.join(dir, file));
        }
        for (const shard of SHARDS) fs.writeFileSync(shardPath(shard), buildShardFlow(spec, shard));
      }
      expect(fs.readdirSync(dir).sort()).toEqual(SHARDS.map((shard) => `shard-${shard}.yaml`));
      for (const shard of SHARDS) {
        expect(fs.readFileSync(shardPath(shard), "utf8")).toBe(buildShardFlow(spec, shard));
      }
    });

    it("covers every component exactly once, one retried golden per case", () => {
      const components = new Set(PARITY_CASES.map((c) => c.component)).size;
      expect(GOLDEN_IDS.length).toBe(components);
      const covered = SHARDS.flatMap(shardIds);
      expect(covered).toEqual(GOLDEN_IDS);
      const flows = SHARDS.map((shard) => buildShardFlow(spec, shard)).join("\n");
      expect(flows.match(/- assertScreenshot:/g)?.length).toBe(GOLDEN_IDS.length);
      expect(flows.match(/^- retry:$/gm)?.length).toBe(GOLDEN_IDS.length);
    });
  },
);

// Story 10-6 AC-8 — one deep link per shard, then in-app `ds-next` steps; each
// navigation runs only when its target case is not on screen, so a per-case
// retry never advances twice.
it("opens one deep link per shard and steps idempotently through the rest", () => {
  for (const platform of ["ios", "android"] as const) {
    for (const shard of SHARDS) {
      const flow = buildShardFlow(FLOWS[platform], shard);
      const ids = shardIds(shard);
      expect(flow.match(/- openLink:/g)?.length).toBe(1);
      expect(flow.match(/tapOn:\n\s+id: "ds-next"/g)?.length).toBe(ids.length - 1);
      expect(flow.match(/when:\n\s+notVisible:/g)?.length).toBe(ids.length);
    }
  }
});

// Story 10-6 AC-7 — every Android shard waits for the app shell before its
// first deep link (cold-start Linking race).
it("Android shards wait for the tab bar before the first deep link", () => {
  for (const shard of SHARDS) {
    const flow = buildShardFlow(FLOWS.android, shard);
    const ready = flow.indexOf('id: "tab-cap"');
    expect(ready).toBeGreaterThan(-1);
    expect(ready).toBeLessThan(flow.indexOf("- openLink:"));
  }
});

// Story 10-6 AC-8 — the CI shard matrix and the gallery path filter stay in
// lock-step with the generator.
it("e2e-mobile.yml runs one job per generated shard and gates the gallery on its paths", () => {
  const workflow = fs.readFileSync(E2E_WORKFLOW, "utf8");
  const matrix = workflow.match(/shard: \[([\d, ]+)\]/g) ?? [];
  expect(matrix.length).toBe(2); // iOS + Android gallery jobs
  for (const entry of matrix) expect(entry).toBe(`shard: [${SHARDS.join(", ")}]`);
  for (const glob of [
    "packages/ui/**",
    "apps/mobile/app/ds/**",
    "apps/mobile/.maestro/goldens/**",
    "apps/mobile/.maestro/gallery/**",
  ]) {
    expect(workflow).toContain(`- "${glob}"`);
  }
});

// apps/mobile/__tests__/maestro-core-flows.test.ts
// Story 10-9 — the Android core Maestro job failed on main because every run
// booted a fresh AVD (the post-job cache never saved: the job failed) and the
// launcher raised a system ANR dialog over the app; preview-guard also tapped
// the system navigation bar once taller text pushed its toggle to the bottom.
// This guard keeps the four hardening pieces from drifting away.
//
// AC-5 (verbatim from story 10-9-android-e2e-emulator-stability):
//   Given the mobile Jest suite, When a core flow waits for "Patrimoine total"
//   before going through the shared Cap-wait subflow, the subflow stops handling
//   the ANR dialog, preview-guard drops the centring, or the Android action goes
//   back to a single post-job AVD cache or stops settling the emulator, Then the
//   suite fails.
export {};

const fs = require("node:fs") as {
  existsSync: (filePath: string) => boolean;
  readFileSync: (filePath: string, encoding: "utf8") => string;
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));
const REPO_ROOT = path.join(MOBILE_ROOT, "..", "..");
const read = (relative: string) => fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");

const CORE_FLOWS = [
  "apps/mobile/.maestro/flows/smoke.yaml",
  "apps/mobile/.maestro/flows/navigation.yaml",
  "apps/mobile/.maestro/flows/preview-guard.yaml",
  "apps/mobile/.maestro/flows/action-sheet-android.yaml",
];
const WAIT_FOR_CAP = "apps/mobile/.maestro/subflows/wait-for-cap.yaml";
const ACTION = ".github/actions/maestro-android/action.yml";
const SETTLE = ".github/scripts/android-settle.sh";

describe("Android core Maestro hardening (story 10-9)", () => {
  // AC-3 (verbatim): Given any core Maestro flow (smoke, navigation,
  //   preview-guard, Android action sheet) on Android or iOS, When the app
  //   launches and a system ANR dialog is on screen, Then the flow answers
  //   "Wait" and still waits for the Cap screen ("Patrimoine total"), retrying
  //   that check up to twice before failing;
  it.each(CORE_FLOWS)("%s waits for Cap through the shared subflow", (flow) => {
    const text = read(flow);
    const subflow = text.indexOf("runFlow: ../subflows/wait-for-cap.yaml");
    expect(subflow).toBeGreaterThan(-1);
    const firstCap = text.indexOf('"Patrimoine total"');
    if (firstCap !== -1) expect(subflow).toBeLessThan(firstCap);
  });

  it("answers a system ANR dialog with Wait, then retries the Cap check", () => {
    const text = read(WAIT_FOR_CAP);
    expect(text).toMatch(/^- retry:\n {4}maxRetries: 2\n/m);
    expect(text).toContain('id: "android:id/aerr_wait"');
    expect(text).toContain('visible: "Patrimoine total"');
  });

  // AC-4 (verbatim): When the preview-guard flow scrolls to the toggle and taps
  //   it, Then the toggle is centred on screen first, so the tap reaches it.
  it("centres the third-party AI toggle before preview-guard taps it", () => {
    const text = read("apps/mobile/.maestro/flows/preview-guard.yaml");
    expect(text).toMatch(
      /- scrollUntilVisible:\n {4}element:\n {6}id: "llm-optin-switch"\n(?: {4}.*\n)*? {4}centerElement: true\n/,
    );
  });

  // AC-1 (verbatim): When the emulator snapshot has been created, Then the
  //   snapshot is saved to the cache before any Maestro flow runs.
  // AC-2 (verbatim): When the snapshot is about to be taken or the APK is about
  //   to be installed, Then the job waits until the launcher has held the focus
  //   for three consecutive polls (at most 240 s) And answers any system "isn't
  //   responding" dialog with "Wait" instead of letting it cover the app.
  it("saves the AVD snapshot before any flow runs and settles the emulator", () => {
    const text = read(ACTION);
    expect(text).toContain("uses: actions/cache/restore@v4");
    expect(text).toContain("uses: actions/cache/save@v4");
    expect(text).toContain("key: avd-${{ env.ANDROID_API }}-x86_64-pixel_7-v2");
    expect(text).not.toMatch(/uses: actions\/cache@v4\n(?: {6}.*\n)* {10}~\/\.android\/avd/);
    expect(text.indexOf("uses: actions/cache/save@v4")).toBeLessThan(
      text.indexOf("name: Run Maestro flows"),
    );
    expect(text.split("bash .github/scripts/android-settle.sh emulator-5554").length - 1).toBe(2);
    expect(fs.existsSync(path.join(REPO_ROOT, SETTLE))).toBe(true);
    expect(read(SETTLE)).toContain("android:id/aerr_wait");
  });
});

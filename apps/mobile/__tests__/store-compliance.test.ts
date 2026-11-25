// apps/mobile/__tests__/store-compliance.test.ts
// Story 10-7 AC-8 — class-killer meta-test asserting App Store & Google Play
// invariants mechanically so pre-submission regressions fail CI immediately.
interface BinaryBuffer {
  readUInt32BE: (offset: number) => number;
  readUInt8: (offset: number) => number;
}

const { existsSync, readFileSync } = require("node:fs") as {
  existsSync: (filePath: string) => boolean;
  readFileSync: {
    (filePath: string, encoding: "utf8"): string;
    (filePath: string): BinaryBuffer;
  };
};
const path = require("node:path") as {
  dirname: (filePath: string) => string;
  join: (...segments: string[]) => string;
};

const resolveModule = (require as unknown as { resolve: (id: string) => string }).resolve;
const MOBILE_ROOT = path.dirname(resolveModule("../package.json"));

/** PNG IHDR color-type byte at offset 25: 2 = RGB (no alpha), 4/6 = has alpha. */
function pngHeader(filePath: string): { width: number; height: number; colorType: number } {
  const buf = readFileSync(filePath);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

// AC-3, AC-6, AC-7 & AC-8 (verbatim from story 10-7-store-compliance-and-agent-testers:29,32-34):
//   automated store-compliance test asserting export compliance, privacy
//   manifest data types, 1024×1024 RGB no-alpha icon, clean production build
//   profile, and valid 8-persona catalog
describe("store compliance invariants (story 10-7, AC-3, AC-6, AC-7, AC-8)", () => {
  const appJson = JSON.parse(readFileSync(path.join(MOBILE_ROOT, "app.json"), "utf8"));
  const easJson = JSON.parse(readFileSync(path.join(MOBILE_ROOT, "eas.json"), "utf8"));

  it("declares iOS export compliance (usesNonExemptEncryption: false) and supportsTablet: true", () => {
    expect(appJson.expo.ios.config.usesNonExemptEncryption).toBe(false);
    expect(appJson.expo.ios.supportsTablet).toBe(true);
  });

  it("declares complete iOS Privacy Manifest (tracking disabled, required-reason APIs, linked App Functionality data types)", () => {
    const manifest = appJson.expo.ios.privacyManifests;
    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(manifest.NSPrivacyTrackingDomains).toEqual([]);

    const apiReasons = manifest.NSPrivacyAccessedAPITypes.flatMap(
      (entry: { NSPrivacyAccessedAPITypeReasons: string[] }) =>
        entry.NSPrivacyAccessedAPITypeReasons,
    );
    expect(apiReasons).toEqual(expect.arrayContaining(["CA92.1", "C617.1", "35F9.1"]));

    const byType = new Map<
      string,
      {
        NSPrivacyCollectedDataTypeLinked: boolean;
        NSPrivacyCollectedDataTypeTracking: boolean;
        NSPrivacyCollectedDataTypePurposes: string[];
      }
    >(
      manifest.NSPrivacyCollectedDataTypes.map(
        (d: {
          NSPrivacyCollectedDataType: string;
          NSPrivacyCollectedDataTypeLinked: boolean;
          NSPrivacyCollectedDataTypeTracking: boolean;
          NSPrivacyCollectedDataTypePurposes: string[];
        }) => [d.NSPrivacyCollectedDataType, d],
      ),
    );
    for (const key of [
      "NSPrivacyCollectedDataTypeEmailAddress",
      "NSPrivacyCollectedDataTypeOtherFinancialInfo",
    ]) {
      const entry = byType.get(key);
      expect(entry).toBeDefined();
      expect(entry?.NSPrivacyCollectedDataTypeLinked).toBe(true);
      expect(entry?.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry?.NSPrivacyCollectedDataTypePurposes).toEqual([
        "NSPrivacyCollectedDataTypePurposeAppFunctionality",
      ]);
    }
  });

  it("ships 1024x1024 RGB no-alpha app icon plus RGBA transparent adaptive and light/dark splash assets", () => {
    expect(appJson.expo.icon).toBe("./assets/icon.png");
    const icon = pngHeader(path.join(MOBILE_ROOT, "assets/icon.png"));
    expect(icon).toEqual({ width: 1024, height: 1024, colorType: 2 });

    const adaptivePath = path.join(MOBILE_ROOT, appJson.expo.android.adaptiveIcon.foregroundImage);
    expect(existsSync(adaptivePath)).toBe(true);
    expect(pngHeader(adaptivePath)).toEqual({ width: 1024, height: 1024, colorType: 6 });

    const splashPlugin = appJson.expo.plugins.find(
      (p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ) as [string, { image: string; dark: { image: string } }];
    expect(splashPlugin).toBeDefined();
    for (const rel of [splashPlugin[1].image, splashPlugin[1].dark.image]) {
      const fullPath = path.join(MOBILE_ROOT, rel);
      expect(existsSync(fullPath)).toBe(true);
      expect(pngHeader(fullPath)).toEqual({ width: 512, height: 512, colorType: 6 });
    }
  });

  it("keeps production EAS profile free of localhost/stub overrides and ships valid readiness manifest", () => {
    const prodEnv = JSON.stringify(easJson.build.production.env ?? {});
    expect(prodEnv).not.toMatch(/localhost|127\.0\.0\.1|stub/i);
    expect(easJson.build["e2e-test"].env.EXPO_PUBLIC_ALLOW_PREVIEW).toBe("1");

    const readiness = JSON.parse(
      readFileSync(path.join(MOBILE_ROOT, ".app-review-readiness.json"), "utf8"),
    );
    expect(String(readiness.build)).toContain(appJson.expo.version);
    expect(Object.keys(readiness.checks)).toEqual(
      expect.arrayContaining([
        "demo_account",
        "live_backend",
        "review_notes",
        "screenshots_match_build",
        "account_deletion_device_test",
        "privacy_labels_match_runtime",
        "iap_reachable_by_reviewer",
      ]),
    );
  });

  it("ships valid 8-persona Mobile Agent Testers catalog covering iOS and Android", () => {
    const personas = JSON.parse(
      readFileSync(path.join(MOBILE_ROOT, ".agent-testers/personas.json"), "utf8"),
    ) as Array<{
      id: string;
      platform: string;
      locale: string;
      goal: string;
      device: { simulator?: string; profile?: string; theme?: string };
    }>;
    expect(personas).toHaveLength(8);
    expect(new Set(personas.map((p) => p.id)).size).toBe(8);
    expect(personas.filter((p) => p.platform === "ios")).toHaveLength(4);
    expect(personas.filter((p) => p.platform === "android")).toHaveLength(4);
    for (const persona of personas) {
      expect(persona.locale.length).toBeGreaterThan(0);
      expect(persona.goal.length).toBeGreaterThan(0);
      expect(persona.device.simulator || persona.device.profile).toBeTruthy();
      expect(persona.device.theme).toMatch(/^(light|dark)$/);
    }
  });
});

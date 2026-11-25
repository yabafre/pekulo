// apps/mobile/__tests__/store-compliance.test.ts
// Story 10-7 AC-8 — class-killer meta-test asserting App Store & Google Play
// invariants mechanically so pre-submission regressions fail CI immediately.
interface BinaryBuffer {
  readUInt32BE: (offset: number) => number;
  readUInt8: (offset: number) => number;
}

const { readFileSync } = require("node:fs") as {
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
function pngColorType(filePath: string): { width: number; height: number; colorType: number } {
  const buf = readFileSync(filePath);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

// AC-3, AC-7 & AC-8 (verbatim from story 10-7-store-compliance-and-agent-testers:29,33,34):
//   automated store-compliance test asserting export compliance, privacy
//   manifest data types, 1024×1024 RGB no-alpha icon, clean production build
//   profile, and valid 8-persona catalog
describe("store compliance invariants (story 10-7, AC-3, AC-7, AC-8)", () => {
  const appJson = JSON.parse(readFileSync(path.join(MOBILE_ROOT, "app.json"), "utf8"));
  const easJson = JSON.parse(readFileSync(path.join(MOBILE_ROOT, "eas.json"), "utf8"));

  it("declares iOS export compliance (usesNonExemptEncryption: false)", () => {
    expect(appJson.expo.ios.config.usesNonExemptEncryption).toBe(false);
  });

  it("declares iOS Privacy Manifest with Email and Financial data types and tracking disabled", () => {
    const manifest = appJson.expo.ios.privacyManifests;
    expect(manifest.NSPrivacyTracking).toBe(false);
    const types = manifest.NSPrivacyCollectedDataTypes.map(
      (d: { NSPrivacyCollectedDataType: string }) => d.NSPrivacyCollectedDataType,
    );
    expect(types).toContain("NSPrivacyCollectedDataTypeEmailAddress");
    expect(types).toContain("NSPrivacyCollectedDataTypeOtherFinancialInfo");
  });

  it("ships a 1024x1024 RGB icon with no alpha channel (prevents ITMS-90717)", () => {
    expect(appJson.expo.icon).toBe("./assets/icon.png");
    const { width, height, colorType } = pngColorType(path.join(MOBILE_ROOT, "assets/icon.png"));
    expect(width).toBe(1024);
    expect(height).toBe(1024);
    expect(colorType).toBe(2);
  });

  it("keeps production EAS profile free of localhost/stub overrides", () => {
    const prodEnv = JSON.stringify(easJson.build.production.env ?? {});
    expect(prodEnv).not.toMatch(/localhost|127\.0\.0\.1|stub/i);
    expect(easJson.build["e2e-test"].env.EXPO_PUBLIC_ALLOW_PREVIEW).toBe("1");
  });

  it("ships valid Mobile Agent Testers personas covering iOS and Android", () => {
    const personas = JSON.parse(
      readFileSync(path.join(MOBILE_ROOT, ".agent-testers/personas.json"), "utf8"),
    );
    expect(personas.filter((p: { platform: string }) => p.platform === "ios").length).toBe(4);
    expect(personas.filter((p: { platform: string }) => p.platform === "android").length).toBe(4);
  });
});

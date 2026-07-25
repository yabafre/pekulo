// AC-1 (verbatim from story 9-1-pwa-manifest-and-install:16):
//   Given I open Pekulo in mobile Safari (or Chrome/Android), When I use the
//   platform "Add to Home Screen" affordance, Then the icon installs and the
//   launch screen reflects the manifest: `name` "Pekulo", `display: standalone`,
//   `theme_color` #000000, PNG icons at 192/512 in both `any` and `maskable`
//   purposes, and an `apple-touch-icon` (180×180) is present.
// AC-2 (verbatim from story 9-1-pwa-manifest-and-install:17):
//   ... the reported Performance score is >= 90 (NFR-3, M5). Manifest + icon
//   correctness is asserted automatically by `manifest.test.ts` and by the
//   presence of the `apple-icon` file ...
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

// Minimal PNG IHDR reader — width/height are big-endian uint32 at byte 16/20,
// right after the 8-byte signature + IHDR length/type. Avoids pulling `sharp`
// into the happy-dom test env just to measure a committed asset.
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("PWA manifest", () => {
  const m = manifest();

  it("declares an installable standalone app opening on the dashboard", () => {
    expect(m.name).toBe("Pekulo");
    expect(m.short_name).toBe("Pekulo");
    expect(m.start_url).toBe("/dashboard");
    expect(m.display).toBe("standalone");
  });

  it("uses the TR-strict dark surface for theme + background", () => {
    expect(m.theme_color).toBe("#000000");
    expect(m.background_color).toBe("#000000");
  });

  it("ships 192 and 512 PNG icons in both any and maskable purposes", () => {
    const icons = m.icons ?? [];
    const sizes = icons.map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes).toContain("192x192:maskable");
    expect(sizes).toContain("512x512:maskable");
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      expect(icon.src.startsWith("/icons/")).toBe(true);
    }
  });
});

// AC-1/AC-2: the committed icon assets must actually exist on disk at the
// declared dimensions — the manifest object above only asserts the metadata
// strings, not the real PNGs. `apple-icon.png` under app/ is the Next
// apple-touch-icon convention AC-1 requires (180x180).
describe("PWA icon assets", () => {
  const iconsDir = resolve(import.meta.dirname, "../../public/icons");
  const appleIcon = resolve(import.meta.dirname, "apple-icon.png");

  const cases: Array<[string, number]> = [
    [`${iconsDir}/icon-192.png`, 192],
    [`${iconsDir}/icon-512.png`, 512],
    [`${iconsDir}/icon-192-maskable.png`, 192],
    [`${iconsDir}/icon-512-maskable.png`, 512],
  ];

  it.each(cases)("%s exists at the declared size", (path, size) => {
    expect(existsSync(path)).toBe(true);
    expect(pngSize(path)).toEqual({ width: size, height: size });
  });

  it("ships a 180x180 apple-touch-icon (Next apple-icon convention)", () => {
    expect(existsSync(appleIcon)).toBe(true);
    expect(pngSize(appleIcon)).toEqual({ width: 180, height: 180 });
  });
});

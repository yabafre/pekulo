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
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

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

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

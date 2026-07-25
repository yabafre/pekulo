// apps/web/scripts/generate-pwa-icons.ts
// Generate the PWA icon set from one 1024×1024 brand source (committed by design).
// Run: `bun run generate:pwa-icons`. Outputs are committed to the repo.
//   public/icons/icon-192.png, icon-512.png                     (purpose: any, cover)
//   public/icons/icon-192-maskable.png, icon-512-maskable.png   (purpose: maskable — glyph
//                                                                 padded into the centre 66%
//                                                                 safe zone; the field bleeds the
//                                                                 source's own background colour so
//                                                                 the icon reads as one coherent
//                                                                 full-bleed mark, not a badge)
//   src/app/apple-icon.png                                       (180×180 — Next apple-touch-icon)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "public/icons/_source/pekulo-icon-1024.png");

type Rgba = { r: number; g: number; b: number; alpha: number };

async function write(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, data);
}

// Sample a corner pixel of the source — that's the brand background. Using it as
// the maskable field means the glyph sits on the same colour it already bleeds
// into, so a launcher preferring `maskable` shows a coherent full-bleed icon
// (matching the `any` cover icons) instead of a contrasting square floating on a
// hard-coded field.
async function backgroundColor(): Promise<Rgba> {
  const { data } = await sharp(SOURCE)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, alpha: 1 };
}

async function plain(size: number): Promise<Buffer> {
  return sharp(SOURCE).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function maskable(size: number, field: Rgba): Promise<Buffer> {
  const inner = Math.round(size * 0.66);
  const glyph = await sharp(SOURCE).resize(inner, inner, { fit: "contain" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: field } })
    .composite([{ input: glyph, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const field = await backgroundColor();
  await write(resolve(ROOT, "public/icons/icon-192.png"), await plain(192));
  await write(resolve(ROOT, "public/icons/icon-512.png"), await plain(512));
  await write(resolve(ROOT, "public/icons/icon-192-maskable.png"), await maskable(192, field));
  await write(resolve(ROOT, "public/icons/icon-512-maskable.png"), await maskable(512, field));
  await write(resolve(ROOT, "src/app/apple-icon.png"), await plain(180));
  console.log("✓ PWA icons generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

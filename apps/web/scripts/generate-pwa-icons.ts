// apps/web/scripts/generate-pwa-icons.ts
// Generate the PWA icon set from one 1024×1024 brand source (committed by design).
// Run: `bun run generate:pwa-icons`. Outputs are committed to the repo.
//   public/icons/icon-192.png, icon-512.png                     (purpose: any, cover)
//   public/icons/icon-192-maskable.png, icon-512-maskable.png   (purpose: maskable — glyph
//                                                                 padded into the centre 66%
//                                                                 safe zone on an opaque #000 field)
//   src/app/apple-icon.png                                       (180×180 — Next apple-touch-icon)
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "public/icons/_source/pekulo-icon-1024.png");
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function write(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, data);
}

async function plain(size: number): Promise<Buffer> {
  return sharp(SOURCE).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function maskable(size: number): Promise<Buffer> {
  const inner = Math.round(size * 0.66);
  const glyph = await sharp(SOURCE).resize(inner, inner, { fit: "contain" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BLACK } })
    .composite([{ input: glyph, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  await write(resolve(ROOT, "public/icons/icon-192.png"), await plain(192));
  await write(resolve(ROOT, "public/icons/icon-512.png"), await plain(512));
  await write(resolve(ROOT, "public/icons/icon-192-maskable.png"), await maskable(192));
  await write(resolve(ROOT, "public/icons/icon-512-maskable.png"), await maskable(512));
  await write(resolve(ROOT, "src/app/apple-icon.png"), await plain(180));
  console.log("✓ PWA icons generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

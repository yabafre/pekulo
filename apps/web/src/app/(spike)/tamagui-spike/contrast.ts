// apps/web/src/app/(spike)/tamagui-spike/contrast.ts
// Pure WCAG 2.x relative-luminance + contrast-ratio implementation.
// No DOM, no React — runnable under bun:test or any Node-compatible runtime.
// Spec: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length !== 6) {
    throw new Error(`contrast.ts: only 6-char hex supported, got "${hex}"`);
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}

function channelToLinear(channel8bit: number): number {
  const normalised = channel8bit / 255;
  return normalised <= 0.03928
    ? normalised / 12.92
    : Math.pow((normalised + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rL = channelToLinear(r);
  const gL = channelToLinear(g);
  const bL = channelToLinear(b);
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const fgL = relativeLuminance(foregroundHex);
  const bgL = relativeLuminance(backgroundHex);
  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);
  return (lighter + 0.05) / (darker + 0.05);
}

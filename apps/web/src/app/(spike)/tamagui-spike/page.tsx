// apps/web/src/app/(spike)/tamagui-spike/page.tsx
// Server Component. Renders the HeroBlock proto-slice (Tamagui primitives) and
// keeps the page chrome on plain inline styles so the surrounding shell never
// claims to be on the Tamagui surface contract — the spike's AC-3 visual proof
// is "the Tamagui card, and only the Tamagui card, embodies the dark-mode token
// discipline". Page chrome colors come from tokens.ts so the file lives by the
// SSOT and not by hardcoded hex.

import { HeroBlock } from "./proto-slice";
import { pekuloColors } from "./tokens";

export default function TamaguiSpikePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        backgroundColor: pekuloColors.dark.surface.bg,
        color: pekuloColors.dark.text.primary,
      }}
    >
      <h1 style={{ marginBottom: "24px", fontSize: "1.5rem" }}>
        Tamagui spike — W2 pre-flight
      </h1>
      <HeroBlock />
    </main>
  );
}

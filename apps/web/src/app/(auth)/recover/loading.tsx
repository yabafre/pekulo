// apps/web/src/app/(auth)/recover/loading.tsx
// Suspense fallback for the recover RSC. The page awaits
// supabase.auth.getUser() (a round-trip that validates the session) before it
// can pick request|reset mode, so this paints during that wait (architecture
// loading/error matrix — `(auth)/recover` ships both). Mirrors RecoverForm's
// centered card so the layout doesn't jump when the form resolves.

import { PekuloSkeleton, Section, pekuloSpacing } from "@pekulo/ui";

export default function RecoverLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: pekuloSpacing[4],
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Section ariaLabel="Chargement">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: pekuloSpacing[2],
              marginBottom: pekuloSpacing[4],
            }}
          >
            <PekuloSkeleton width="40%" height={20} />
            <PekuloSkeleton width="65%" height={12} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: pekuloSpacing[3] }}>
            <PekuloSkeleton block height={44} />
            <PekuloSkeleton block height={44} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// apps/web/src/app/(auth)/recover/loading.tsx
// Suspense fallback for the recover RSC. The page awaits
// supabase.auth.getUser() (a round-trip that validates the session) before it
// can pick request|reset mode, so this paints during that wait (architecture
// loading/error matrix — `(auth)/recover` ships both). Mirrors the AuthScreen
// column (brand + borderless card) so nothing jumps when the form resolves —
// the AuthSplit layout owns centring + background.

import { PekuloSkeleton, Section, pekuloSpacing } from "@pekulo/ui";

export default function RecoverLoading() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        display: "flex",
        flexDirection: "column",
        gap: pekuloSpacing[6],
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: pekuloSpacing[2],
        }}
      >
        <PekuloSkeleton width={120} height={30} />
        <PekuloSkeleton width="60%" height={13} />
      </div>
      <Section ariaLabel="Chargement">
        <div style={{ display: "flex", flexDirection: "column", gap: pekuloSpacing[4] }}>
          <PekuloSkeleton width="30%" height={14} />
          <PekuloSkeleton block height={48} />
          <PekuloSkeleton block height={48} />
        </div>
      </Section>
    </div>
  );
}

"use client";

// apps/web/src/app/dashboard/page.tsx
// Client Component because PekuloEmptyState's `icon` prop is a React
// component (function reference) which RSC cannot serialise across the
// server→client boundary. The auth gate lives in the layout (Server
// Component); this page has no server-only work.
import { Compass } from "lucide-react";
import { PekuloEmptyState, Section } from "@pekulo/ui";

export default function DashboardPage() {
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <Section ariaLabel="Tableau de bord en construction">
          <PekuloEmptyState
            icon={Compass}
            title="Tableau de bord en construction"
            message="Définis ton cap dans la story 1-1 ; le dashboard se branche dans 7-1. La couche données reste prête côté serveur."
          />
        </Section>
      </div>
    </div>
  );
}

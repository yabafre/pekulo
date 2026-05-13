// apps/web/src/app/(cap)/parametres/page.tsx
// Async RSC — readCompass runs server-side and pre-fills the form. The form
// + history panel are client islands consuming React Query.
import { readCompass } from "@/lib/data/compass";
import { CompassEditForm } from "./_components/compass-edit-form";
import { CompassHistoryPanel } from "./_components/compass-history-panel";

export default async function ParametresPage() {
  const { compass } = await readCompass();
  return (
    <div style={{ display: "flex", padding: 16, flexDirection: "column", gap: 24 }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <CompassEditForm initial={compass} />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}

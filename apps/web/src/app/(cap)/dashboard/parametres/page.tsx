import { readCompass } from "@/lib/data/compass";
import { CompassEditForm } from "./_components/compass-edit-form";
import { CompassHistoryPanel } from "./_components/compass-history-panel";

export default async function ParametresPage() {
  const { compass } = await readCompass();
  return (
    <div style={{ display: "flex", padding: 16, alignItems: "center", flexDirection: "column" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <CompassEditForm initial={compass} />
        <CompassHistoryPanel />
      </div>
    </div>
  );
}

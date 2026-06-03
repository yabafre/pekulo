// apps/web/src/app/(cap)/dashboard/parametres/journal-ia/page.tsx
// RSC shell for the 90-day LLM activity log (story 6-5, FR-36). Mirror of
// parametres/page.tsx. Lives under (cap)/dashboard/* so the CapShell layout
// (dashboard/layout.tsx) wraps it with the cap-view nav (lesson 2026-05-27 —
// routes under (cap)/anything-but-dashboard render bare).
import { pekuloSpacing } from "@pekulo/ui";
import { LlmActivityLog } from "../../_llm/_components/llm-activity-log";

export default function JournalIaPage() {
  return (
    <div
      style={{
        display: "flex",
        padding: pekuloSpacing[4],
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: pekuloSpacing[6],
        }}
      >
        <LlmActivityLog />
      </div>
    </div>
  );
}

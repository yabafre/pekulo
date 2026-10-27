// AC-1 (verbatim from story 12-4-advisory-private-page:17):
//   Given an allowlisted user (status: "active" or owner: true), When they open /dashboard/advisory,
//   Then the analysis + recommendations render with the prominent "private internal tool — not regulated investment advice" notice visible.
// AC-2 (verbatim from story 12-4-advisory-private-page:18):
//   Given a non-allowlisted or banned user (status: "none" or "banned"), When they navigate to /dashboard/advisory,
//   Then they cannot reach the surface (server-side gate triggers redirect("/dashboard"), no advisory data leaks to the client, and all underlying Server Actions reject with 403 FORBIDDEN).

import { redirect } from "next/navigation";
import { advisoryClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { AdvisoryView } from "./_components/advisory-view";

export default async function AdvisoryPage() {
  await ensureRequestContext();

  let status;
  try {
    status = await advisoryClient.status();
  } catch {
    redirect("/dashboard");
  }

  if (!status || status.access !== "active") {
    redirect("/dashboard");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "16px 8px 0",
        width: "100%",
      }}
    >
      <AdvisoryView initialStatus={status} />
    </div>
  );
}

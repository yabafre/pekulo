// apps/web/src/app/(cap)/dashboard/mensuel/loading.tsx
// Next.js loading boundary — renders during the initial RSC fetch so the
// page never lands blank. Mirrors dashboard/loading.tsx and
// transactions/loading.tsx: PekuloSkeleton inside Section primitives,
// same shape as the loaded page.

import { getTranslations } from "next-intl/server";
import { PekuloSkeleton, Section } from "@pekulo/ui";
import topRowStyles from "./_components/mensuel-top-row.module.css";

export default async function MensuelLoading() {
  const t = await getTranslations("loading");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "8px 4px 0",
        width: "100%",
      }}
    >
      <div className={topRowStyles.row}>
        <div className={topRowStyles.moisEnCours}>
          <Section ariaLabel={t("mensuelCurrent")}>
            <PekuloSkeleton width="40%" height={12} />
            <div style={{ height: 12 }} />
            <PekuloSkeleton block height={48} />
          </Section>
        </div>
        <div className={topRowStyles.cloture}>
          <Section ariaLabel={t("mensuelCloture")}>
            <PekuloSkeleton width="30%" height={12} />
            <div style={{ height: 12 }} />
            <PekuloSkeleton lines={2} height={14} />
          </Section>
        </div>
      </div>
      <Section ariaLabel={t("history")} title={t("historyTitle")}>
        <PekuloSkeleton lines={5} height={36} />
      </Section>
    </div>
  );
}

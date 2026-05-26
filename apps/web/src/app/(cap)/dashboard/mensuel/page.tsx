// apps/web/src/app/(cap)/dashboard/mensuel/page.tsx
// RSC shell — mirrors transactions/portefeuille/immobilier page.tsx shape:
// inline-styled flex column matching the bento.module.css `.main` padding
// chain. The inner 2-col 7/5 grid (Mois en cours + Clôture) needs an
// @media query, so it lives in `mensuel-top-row.module.css`.
//
// Suspense boundaries wrap the data-fetching client sections so the
// loading.tsx sibling stays the SSR loading carrier without forcing the
// whole route to CSR-bail (transactions/page.tsx precedent).

import { Suspense } from "react";
import { MoisEnCoursSection } from "./_components/mois-en-cours-section";
import { ClotureSection } from "./_components/cloture-section";
import { HistoriqueSection } from "./_components/historique-section";
import topRowStyles from "./_components/mensuel-top-row.module.css";

export default function MensuelPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthNum = now.getUTCMonth() + 1;
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
        <Suspense fallback={null}>
          <MoisEnCoursSection
            year={year}
            monthNum={monthNum}
            className={topRowStyles.moisEnCours}
          />
        </Suspense>
        <ClotureSection year={year} monthNum={monthNum} className={topRowStyles.cloture} />
      </div>
      <Suspense fallback={null}>
        <HistoriqueSection limit={6} />
      </Suspense>
    </div>
  );
}

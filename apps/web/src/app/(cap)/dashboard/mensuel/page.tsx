// apps/web/src/app/(cap)/dashboard/mensuel/page.tsx
// RSC shell — mirrors transactions/portefeuille/immobilier page.tsx shape:
// inline-styled flex column matching the bento.module.css `.main` padding
// chain. The inner 2-col 7/5 grid (Mois en cours + Clôture) needs an
// @media query so it lives in `mensuel-top-row.module.css`.
//
// No Suspense wrappers: useActionQuery doesn't throw/suspend (it surfaces
// loading via the isLoading flag the sections gate on), so a Suspense
// boundary here is dead weight that also creates structural asymmetry in
// the React tree between the two top-row cards.

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
        <MoisEnCoursSection year={year} monthNum={monthNum} className={topRowStyles.moisEnCours} />
        <ClotureSection year={year} monthNum={monthNum} className={topRowStyles.cloture} />
      </div>
      <HistoriqueSection limit={6} />
    </div>
  );
}

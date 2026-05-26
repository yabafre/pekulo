// apps/web/src/app/(cap)/dashboard/mensuel/page.tsx
// Server Component — computes the current (year, monthNum) at request
// time so all client children consume the same key. Mirrors ux-preview
// MonthlyScreen (App.tsx:1551+): 2-col top row (Mois en cours 7/12 +
// Clôture 5/12) + Historique full-width below.

import { MoisEnCoursSection } from "./_components/mois-en-cours-section";
import { ClotureSection } from "./_components/cloture-section";
import { HistoriqueSection } from "./_components/historique-section";
import styles from "./_components/mensuel.module.css";

export default function MensuelPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthNum = now.getUTCMonth() + 1;
  return (
    <div className={styles.page} aria-label="Mensuel">
      <div className={styles.topRow}>
        <div className={styles.moisEnCours}>
          <MoisEnCoursSection year={year} monthNum={monthNum} />
        </div>
        <div className={styles.cloture}>
          <ClotureSection year={year} monthNum={monthNum} />
        </div>
      </div>
      <HistoriqueSection limit={6} />
    </div>
  );
}

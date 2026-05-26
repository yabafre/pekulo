// apps/web/src/app/(cap)/mensuel/page.tsx
// Server Component — computes the current (year, monthNum) at request time
// so all client children consume the same key. Server-side compute avoids
// the hydration mismatch a `new Date()` in a client component would
// trigger if SSR/CSR clocks drifted across a midnight boundary.

import { MoisEnCoursSection } from "./_components/mois-en-cours-section";

export default function MensuelPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthNum = now.getUTCMonth() + 1;
  return (
    <main aria-label="Mensuel">
      <MoisEnCoursSection year={year} monthNum={monthNum} />
    </main>
  );
}

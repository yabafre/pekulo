// apps/web/src/lib/config.ts
// Display data for the 4-phase financial plan (Persona #1 — Alex). The shape
// + data are the SSOT for the eventual `/dashboard/cap/plan` Phase view
// (architecture FR-2-x family) ; lifted out of a page component to keep the
// route file thin once the view ships.
//
// Removed in PR #86 audit then restored — product content, not orphan code.

export interface Phase {
  num: string;
  name: string;
  detail: string;
  epargne: string;
  duree: string;
  statut: string;
}

export const phases: Phase[] = [
  {
    num: "Phase 0",
    name: "Matelas 10 000 €",
    detail: "Livret A / LDDS",
    epargne: "1 000 €/mois",
    duree: "9 mois",
    statut: "Atteint",
  },
  {
    num: "Phase 1",
    name: "2026 (mai → déc.)",
    detail: "DCA PEA",
    epargne: "1 000 – 1 200 €/mois",
    duree: "8 mois",
    statut: "En cours",
  },
  {
    num: "Phase 2",
    name: "2027+",
    detail: "Crédit étudiant",
    epargne: "700 – 900 €/mois",
    duree: "Continu",
    statut: "À venir",
  },
  {
    num: "Phase 3",
    name: "Remote actif",
    detail: "Asie / Europe Est",
    epargne: "1 500 – 2 000 €/mois",
    duree: "6 mois/an",
    statut: "À venir",
  },
];

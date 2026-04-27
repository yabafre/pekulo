import {
  type KpiData,
  type MonthlyRecord,
  type AnnualSummary,
  type ScenarioItem,
  type BudgetItem,
  type RevenueItem,
} from "./types"

export const kpiData: KpiData = {
  netReel: 3700,
  pouvoirAchat: 3943,
  epargneMois: 1210,
  capitalProjete: 145738,
  objectif: 100000,
  progression: 145.7,
}

export const monthlyData: MonthlyRecord[] = [
  { month: "mai 2026", year: 2026, monthNum: 5, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 1000, freelance: 300, epargneMois: 2510, perfMarche: 0, epargneCumul: 2510, capitalTotal: 2510 },
  { month: "juin 2026", year: 2026, monthNum: 6, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 1000, freelance: 300, epargneMois: 2510, perfMarche: 14.2, epargneCumul: 5020, capitalTotal: 5034 },
  { month: "juil. 2026", year: 2026, monthNum: 7, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 28.5, epargneCumul: 6530, capitalTotal: 6573 },
  { month: "août 2026", year: 2026, monthNum: 8, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 37.2, epargneCumul: 8040, capitalTotal: 8120 },
  { month: "sept. 2026", year: 2026, monthNum: 9, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 45.9, epargneCumul: 9550, capitalTotal: 9676 },
  { month: "oct. 2026", year: 2026, monthNum: 10, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 54.7, epargneCumul: 11060, capitalTotal: 11240 },
  { month: "nov. 2026", year: 2026, monthNum: 11, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 63.6, epargneCumul: 12570, capitalTotal: 12814 },
  { month: "déc. 2026", year: 2026, monthNum: 12, net: 3700, avantages: 243, depenses: 2490, credit: 0, remote: 0, freelance: 300, epargneMois: 1510, perfMarche: 72.5, epargneCumul: 14080, capitalTotal: 14396 },
  { month: "janv. 2027", year: 2027, monthNum: 1, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 81.4, epargneCumul: 16451, capitalTotal: 16849 },
  { month: "févr. 2027", year: 2027, monthNum: 2, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 95.3, epargneCumul: 18822, capitalTotal: 19315 },
  { month: "mars 2027", year: 2027, monthNum: 3, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 109.2, epargneCumul: 21193, capitalTotal: 21795 },
  { month: "avr. 2027", year: 2027, monthNum: 4, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 123.2, epargneCumul: 23564, capitalTotal: 24290 },
  { month: "mai 2027", year: 2027, monthNum: 5, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 137.3, epargneCumul: 25935, capitalTotal: 26798 },
  { month: "juin 2027", year: 2027, monthNum: 6, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2371, perfMarche: 151.5, epargneCumul: 28306, capitalTotal: 29320 },
  { month: "juil. 2027", year: 2027, monthNum: 7, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 165.8, epargneCumul: 29677, capitalTotal: 30857 },
  { month: "août 2027", year: 2027, monthNum: 8, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 174.5, epargneCumul: 31048, capitalTotal: 32403 },
  { month: "sept. 2027", year: 2027, monthNum: 9, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 183.2, epargneCumul: 32419, capitalTotal: 33957 },
  { month: "oct. 2027", year: 2027, monthNum: 10, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 192.0, epargneCumul: 33790, capitalTotal: 35520 },
  { month: "nov. 2027", year: 2027, monthNum: 11, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 200.8, epargneCumul: 35161, capitalTotal: 37092 },
  { month: "déc. 2027", year: 2027, monthNum: 12, net: 3811, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1371, perfMarche: 209.7, epargneCumul: 36532, capitalTotal: 38672 },
  { month: "janv. 2028", year: 2028, monthNum: 1, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 218.7, epargneCumul: 39017, capitalTotal: 41376 },
  { month: "févr. 2028", year: 2028, monthNum: 2, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 233.9, epargneCumul: 41503, capitalTotal: 44096 },
  { month: "mars 2028", year: 2028, monthNum: 3, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 249.3, epargneCumul: 43988, capitalTotal: 46830 },
  { month: "avr. 2028", year: 2028, monthNum: 4, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 264.8, epargneCumul: 46473, capitalTotal: 49580 },
  { month: "mai 2028", year: 2028, monthNum: 5, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 280.3, epargneCumul: 48959, capitalTotal: 52346 },
  { month: "juin 2028", year: 2028, monthNum: 6, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2485, perfMarche: 296.0, epargneCumul: 51444, capitalTotal: 55127 },
  { month: "juil. 2028", year: 2028, monthNum: 7, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 311.7, epargneCumul: 52929, capitalTotal: 56924 },
  { month: "août 2028", year: 2028, monthNum: 8, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 321.9, epargneCumul: 54415, capitalTotal: 58732 },
  { month: "sept. 2028", year: 2028, monthNum: 9, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 332.1, epargneCumul: 55900, capitalTotal: 60549 },
  { month: "oct. 2028", year: 2028, monthNum: 10, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 342.4, epargneCumul: 57385, capitalTotal: 62377 },
  { month: "nov. 2028", year: 2028, monthNum: 11, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 352.7, epargneCumul: 58871, capitalTotal: 64215 },
  { month: "déc. 2028", year: 2028, monthNum: 12, net: 3925, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1485, perfMarche: 363.1, epargneCumul: 60356, capitalTotal: 66063 },
  { month: "janv. 2029", year: 2029, monthNum: 1, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 373.5, epargneCumul: 62959, capitalTotal: 69040 },
  { month: "févr. 2029", year: 2029, monthNum: 2, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 390.4, epargneCumul: 65562, capitalTotal: 72033 },
  { month: "mars 2029", year: 2029, monthNum: 3, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 407.3, epargneCumul: 68165, capitalTotal: 75044 },
  { month: "avr. 2029", year: 2029, monthNum: 4, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 424.3, epargneCumul: 70768, capitalTotal: 78071 },
  { month: "mai 2029", year: 2029, monthNum: 5, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 441.4, epargneCumul: 73371, capitalTotal: 81116 },
  { month: "juin 2029", year: 2029, monthNum: 6, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2603, perfMarche: 458.6, epargneCumul: 75974, capitalTotal: 84177 },
  { month: "juil. 2029", year: 2029, monthNum: 7, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 476.0, epargneCumul: 77578, capitalTotal: 86256 },
  { month: "août 2029", year: 2029, monthNum: 8, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 487.7, epargneCumul: 79181, capitalTotal: 88347 },
  { month: "sept. 2029", year: 2029, monthNum: 9, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 499.5, epargneCumul: 80784, capitalTotal: 90450 },
  { month: "oct. 2029", year: 2029, monthNum: 10, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 511.4, epargneCumul: 82387, capitalTotal: 92564 },
  { month: "nov. 2029", year: 2029, monthNum: 11, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 523.4, epargneCumul: 83990, capitalTotal: 94691 },
  { month: "déc. 2029", year: 2029, monthNum: 12, net: 4043, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1603, perfMarche: 535.4, epargneCumul: 85593, capitalTotal: 96829 },
  { month: "janv. 2030", year: 2030, monthNum: 1, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 547.5, epargneCumul: 88317, capitalTotal: 100101 },
  { month: "févr. 2030", year: 2030, monthNum: 2, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 566.0, epargneCumul: 91042, capitalTotal: 103391 },
  { month: "mars 2030", year: 2030, monthNum: 3, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 584.6, epargneCumul: 93766, capitalTotal: 106700 },
  { month: "avr. 2030", year: 2030, monthNum: 4, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 603.3, epargneCumul: 96491, capitalTotal: 110028 },
  { month: "mai 2030", year: 2030, monthNum: 5, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 622.1, epargneCumul: 99215, capitalTotal: 113375 },
  { month: "juin 2030", year: 2030, monthNum: 6, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2724, perfMarche: 641.0, epargneCumul: 101939, capitalTotal: 116740 },
  { month: "juil. 2030", year: 2030, monthNum: 7, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 660.1, epargneCumul: 103664, capitalTotal: 119124 },
  { month: "août 2030", year: 2030, monthNum: 8, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 673.5, epargneCumul: 105388, capitalTotal: 121522 },
  { month: "sept. 2030", year: 2030, monthNum: 9, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 687.1, epargneCumul: 107112, capitalTotal: 123934 },
  { month: "oct. 2030", year: 2030, monthNum: 10, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 700.7, epargneCumul: 108837, capitalTotal: 126359 },
  { month: "nov. 2030", year: 2030, monthNum: 11, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 714.5, epargneCumul: 110561, capitalTotal: 128798 },
  { month: "déc. 2030", year: 2030, monthNum: 12, net: 4164, avantages: 243, depenses: 2490, credit: 250, remote: 0, freelance: 300, epargneMois: 1724, perfMarche: 728.2, epargneCumul: 112286, capitalTotal: 131250 },
  { month: "janv. 2031", year: 2031, monthNum: 1, net: 4289, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2849, perfMarche: 742.1, epargneCumul: 115135, capitalTotal: 134842 },
  { month: "févr. 2031", year: 2031, monthNum: 2, net: 4289, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2849, perfMarche: 762.4, epargneCumul: 117984, capitalTotal: 138454 },
  { month: "mars 2031", year: 2031, monthNum: 3, net: 4289, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2849, perfMarche: 782.8, epargneCumul: 120834, capitalTotal: 142086 },
  { month: "avr. 2031", year: 2031, monthNum: 4, net: 4289, avantages: 243, depenses: 2490, credit: 250, remote: 1000, freelance: 300, epargneMois: 2849, perfMarche: 803.4, epargneCumul: 123683, capitalTotal: 145738 },
]

export const annualSummaries: AnnualSummary[] = [
  { periode: "mai 2026 → avr. 2027", epargneAnnuelle: 23564, perfMarche: 726, capitalFin: 24290 },
  { periode: "mai 2027 → avr. 2028", epargneAnnuelle: 22909, perfMarche: 2382, capitalFin: 49580 },
  { periode: "mai 2028 → avr. 2029", epargneAnnuelle: 24295, perfMarche: 4196, capitalFin: 78071 },
  { periode: "mai 2029 → avr. 2030", epargneAnnuelle: 25722, perfMarche: 6235, capitalFin: 110028 },
  { periode: "mai 2030 → avr. 2031", epargneAnnuelle: 27192, perfMarche: 8518, capitalFin: 145738 },
]

export const scenarios: ScenarioItem[] = [
  { name: "Conservateur", capitalFin: 42303, epargne: 37200, perf: 5103, taux: 5, moisEpargne1: 700, moisEpargne2: 600 },
  { name: "Réaliste", capitalFin: 60551, epargne: 50400, perf: 10151, taux: 7, moisEpargne1: 1000, moisEpargne2: 800 },
  { name: "Agressif (Remote)", capitalFin: 90827, epargne: 75600, perf: 15227, taux: 7, moisEpargne1: 1500, moisEpargne2: 1200 },
]

export const budgetData: BudgetItem[] = [
  { categorie: "Charges fixes", montant: 1520, sousItems: [
    { label: "Loyer", montant: 1125 }, { label: "Courses", montant: 200 }, { label: "Transport", montant: 45 }, { label: "Autres charges", montant: 150 }
  ]},
  { categorie: "Lifestyle", montant: 370, sousItems: [
    { label: "Sorties", montant: 250 }, { label: "Divers", montant: 120 }
  ]},
  { categorie: "Voyage", montant: 600 },
  { categorie: "Épargne (Phase 1)", montant: 1210 },
]

export const revenueData: RevenueItem[] = [
  { label: "Salaire net", montant: 3700 },
  { label: "Tickets resto", montant: 168 },
  { label: "Pass Navigo", montant: 45 },
  { label: "Mutuelle", montant: 30 },
]

export const phases = [
  { num: "Phase 0", name: "Matelas 10 000 €", detail: "Livret A / LDDS", epargne: "1 000 €/mois", duree: "9 mois", statut: "Atteint" },
  { num: "Phase 1", name: "2026 (mai → déc.)", detail: "DCA PEA", epargne: "1 000 – 1 200 €/mois", duree: "8 mois", statut: "En cours" },
  { num: "Phase 2", name: "2027+", detail: "Crédit étudiant", epargne: "700 – 900 €/mois", duree: "Continu", statut: "À venir" },
  { num: "Phase 3", name: "Remote actif", detail: "Asie / Europe Est", epargne: "1 500 – 2 000 €/mois", duree: "6 mois/an", statut: "À venir" },
]

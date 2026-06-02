// apps/api/src/modules/logos/merchant-domains.ts
// Story 6-10 (FR-65) — curated FR/global merchant alias → clean Brandfetch query.
// PURE — no I/O. The Brandfetch search misses when a known brand is BURIED in a
// noisy bank label (e.g. "CB Mad Cours Mcdonald S Agdal Oncf" normalises to the
// key "mad cours mcdonald" → Brandfetch returns [], so tier 1 silently falls to
// the bank logo). This map gives the high-recall path: scan ALL the label's
// tokens for a known merchant alias and, on a hit, search Brandfetch with the
// CLEAN brand name — which the relevance guard then accepts (name prefix match).
//
// Curation rules: keys are normalised (lower-case, de-accented, alphanumeric)
// single tokens or "word word" bigrams; values are clean brand queries. Avoid
// short/ambiguous tokens that collide with statement vocabulary (no "bp",
// "free", "paul", "casino"). Edit freely — this is a maintained allowlist, not
// a generated artefact. A curated miss simply falls through to the raw search.

const MERCHANT_ALIASES: Record<string, string> = {
  // Grande distribution
  carrefour: "carrefour",
  monoprix: "monoprix",
  franprix: "franprix",
  auchan: "auchan",
  leclerc: "leclerc",
  intermarche: "intermarche",
  lidl: "lidl",
  aldi: "aldi",
  naturalia: "naturalia",
  biocoop: "biocoop",
  picard: "picard",
  cora: "cora",
  marjane: "marjane",
  "grand frais": "grand frais",
  // Restauration / food delivery
  mcdonald: "mcdonalds",
  mcdonalds: "mcdonalds",
  mcdo: "mcdonalds",
  "burger king": "burger king",
  kfc: "kfc",
  subway: "subway",
  starbucks: "starbucks",
  dominos: "dominos pizza",
  flunch: "flunch",
  "brioche doree": "brioche doree",
  "uber eats": "uber eats",
  deliveroo: "deliveroo",
  "just eat": "just eat",
  toogoodtogo: "too good to go",
  // Transport / mobilité / carburant
  uber: "uber",
  sncf: "sncf",
  ratp: "ratp",
  blablacar: "blablacar",
  flixbus: "flixbus",
  "vinci autoroutes": "vinci autoroutes",
  totalenergies: "totalenergies",
  total: "totalenergies",
  shell: "shell",
  esso: "esso",
  // E-commerce / tech / abos payants
  amazon: "amazon",
  cdiscount: "cdiscount",
  zalando: "zalando",
  veepee: "veepee",
  vinted: "vinted",
  aliexpress: "aliexpress",
  fnac: "fnac",
  darty: "darty",
  boulanger: "boulanger",
  "leroy merlin": "leroy merlin",
  castorama: "castorama",
  ikea: "ikea",
  apple: "apple",
  google: "google",
  microsoft: "microsoft",
  adobe: "adobe",
  paypal: "paypal",
  steam: "steam",
  netflix: "netflix",
  spotify: "spotify",
  deezer: "deezer",
  disney: "disney plus",
  canal: "canal plus",
  // Mode / beauté / sport
  zara: "zara",
  uniqlo: "uniqlo",
  decathlon: "decathlon",
  sephora: "sephora",
  nocibe: "nocibe",
  kiabi: "kiabi",
  primark: "primark",
  // Télécom / énergie
  orange: "orange",
  sfr: "sfr",
  "bouygues telecom": "bouygues telecom",
  bouygues: "bouygues telecom",
  "free mobile": "free mobile",
  engie: "engie",
  edf: "edf",
  // Logistique / poste
  "la poste": "la poste",
  chronopost: "chronopost",
  colissimo: "colissimo",
  "mondial relay": "mondial relay",
  ups: "ups",
  fedex: "fedex",
  dhl: "dhl",
  // Assurances
  maif: "maif",
  macif: "macif",
  matmut: "matmut",
  allianz: "allianz",
};

function tokenize(label: string): string[] {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Scan the FULL label (not just the 3-token cache key) for a known merchant
// alias. Bigrams are checked before unigrams so "uber eats" beats "uber" and
// "burger king" beats a bare "burger". Returns the clean Brandfetch query, or
// null when no alias matches (→ caller falls back to the raw-key search).
export function curatedMerchantQuery(label: string): string | null {
  const tokens = tokenize(label);
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    const hit = MERCHANT_ALIASES[bigram];
    if (hit) return hit;
  }
  for (const t of tokens) {
    const hit = MERCHANT_ALIASES[t];
    if (hit) return hit;
  }
  return null;
}

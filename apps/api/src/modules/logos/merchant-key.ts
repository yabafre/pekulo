// apps/api/src/modules/logos/merchant-key.ts
// Story 6-10 (FR-65). PURE — no I/O, no clock, no env. Normalises a raw bank
// transaction label ("CB Mad Cours Marjane M.m G", "PAIEMENT PAR CARTE 09/11
// CARREFOUR CITY") into a stable lower-case merchant key used BOTH as the
// merchant_logo_cache primary key AND as the Brandfetch Brand Search query.
// Deterministic: same label → same key (cache hit rate + reproducibility).

// Tokens that are pure bank/card noise, never part of a merchant name. Stored
// de-accented (matches the post-NFD token), lower-case. The second block is
// statement-line vocabulary (deferred statements, instalments, tax/admin debits)
// that otherwise prefix-matches a random brand — see the 6-10 review dry-run.
const NOISE = new Set([
  "cb",
  "paiement",
  "par",
  "carte",
  "virement",
  "vir",
  "prlv",
  "prelevement",
  "achat",
  "retrait",
  "dab",
  "sepa",
  "facture",
  "ref",
  // non-merchant statement lines (kill false-positive logo matches)
  "releve",
  "differe",
  "temporary",
  "transaction",
  "echeance",
  "commission",
  "direction",
  "generale",
  "inst",
]);

// Strip leading "CB", card-payment prose, dates (dd/mm[/yy[yy]]), standalone
// numbers/amounts and 1-char tokens, then keep the first 3 meaningful tokens.
export function normalizeMerchantKey(label: string): string {
  const deaccented = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // strip combining accents (NFD diacritics)
  // Person-to-person transfers ("Vir Sepa M John Doe", "Vir Inst Mme Jane Doe")
  // name an individual, not a merchant — a civility title after a transfer verb
  // is the tell. Never resolve a logo for them (the name would prefix-match a
  // random brand, e.g. "John Doe Game").
  if (/\b(vir|virement)\b/.test(deaccented) && /\b(m|mr|mme|mlle)\b/.test(deaccented)) {
    return "";
  }
  const cleaned = deaccented
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, " ") // dates
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → space
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+$/.test(t));
  return cleaned.slice(0, 3).join(" ").trim();
}

// True when the normalised key is too thin to be a usable Brandfetch query
// (e.g. label was all noise). Callers skip resolution → tier-2/tier-3 fallback.
export function isResolvableMerchantKey(key: string): boolean {
  return key.length >= 3;
}

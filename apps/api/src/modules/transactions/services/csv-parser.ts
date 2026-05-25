// apps/api/src/modules/transactions/services/csv-parser.ts
// Pure CSV parser + per-row validator + account-resolution loop (story 5-2).
//
// Contract:
//   - Accepts positional 4-column CSV (date, amount, label, account-label).
//     NO header row, NO column mapping — kept deterministic for V1.
//   - Throws PekuloError("INVALID_CSV") on csv-parse exceptions or column
//     count mismatch at the global level (an empty CSV is INVALID_CSV).
//   - Throws PekuloError("PAYLOAD_TOO_LARGE") when row count > MAX_CSV_ROWS.
//   - Returns row-by-row breakdown — per-row errors (bad date, ambiguous
//     account, etc.) are DATA, not exceptions.

import { parse } from "csv-parse/sync";
import { PekuloError } from "../../../common/errors";
import type {
  PreviewedRow,
  RawCsvRow,
  TransactionCategory,
  TransactionType,
} from "@pekulo/validators";

export const MAX_CSV_ROWS = 1000;

const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Strict numeric parser for CSV amount fields.
// Accepts:
//   - ISO/US decimal:        "42.50", "-1200.00", "+3500"
//   - FR comma decimal:      "1,50"          (Trade Republic / FR bank exports)
//   - Whitespace thousands:  "1 200.50", "1 200,50"
//   - US comma thousands:    "1,200.50", "1,000,000.50"
// Rejects: scientific notation ("1e3"), Infinity/NaN passthrough, multi-dot,
// trailing/leading dot, mixed unparseable input. Returns null on reject —
// callers map null to a row-level INVALID error.
function parseAmountString(raw: string): number | null {
  const stripped = raw.replace(/\s+/g, "");
  if (stripped.length === 0) return null;
  let normalized = stripped;
  if (/^[+-]?\d+,\d+$/.test(stripped)) {
    // Single comma, no dot — FR decimal.
    normalized = stripped.replace(",", ".");
  } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(stripped)) {
    // US thousands: 1,234 or 1,234.56 or 1,000,000.50.
    normalized = stripped.replace(/,/g, "");
  } else if (!/^[+-]?\d+(\.\d+)?$/.test(stripped)) {
    return null;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export interface AccountResolver {
  resolve(userId: string, label: string): Promise<{ id: string | null; matchCount: number }>;
}

export interface ParseCsvForPreviewDeps {
  csvText: string;
  userId: string;
  accountResolver: AccountResolver;
}

export interface ParseCsvForPreviewOutput {
  rows: PreviewedRow[];
  summary: { total: number; valid: number; invalid: number };
}

export async function parseCsvForPreview(
  deps: ParseCsvForPreviewDeps,
): Promise<ParseCsvForPreviewOutput> {
  let records: string[][];
  try {
    records = parse(deps.csvText, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch (err) {
    throw new PekuloError("INVALID_CSV", err instanceof Error ? err.message : "csv parse failed");
  }

  if (records.length === 0) {
    throw new PekuloError("INVALID_CSV", "csv has no rows");
  }
  if (records.length > MAX_CSV_ROWS) {
    throw new PekuloError(
      "PAYLOAD_TOO_LARGE",
      `csv has ${records.length} rows (max ${MAX_CSV_ROWS})`,
    );
  }

  const rows: PreviewedRow[] = [];
  let valid = 0;
  let invalid = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const raw: RawCsvRow = {
      occurredOn: record[0] ?? "",
      amountRaw: record[1] ?? "",
      label: record[2] ?? "",
      accountLabel: record[3] ?? "",
    };

    const rowError = (msg: string): void => {
      rows.push({ index: i, raw, error: msg });
      invalid++;
    };

    // User-facing strings (FR). The row's raw input is already rendered
    // in the preview table cells — don't echo field values back into the
    // error text. Reviewer feedback 2026-05-25 (Alex): "l'affichage d'erreur
    // n'est pas bon" — fixed by removing the redundancy.

    if (record.length !== 4) {
      rowError(`Format invalide : ${record.length} colonne(s) au lieu de 4`);
      continue;
    }

    if (!ISO_DATE_REGEX.test(raw.occurredOn)) {
      rowError("Date invalide (format attendu : YYYY-MM-DD)");
      continue;
    }
    const dateCheck = new Date(`${raw.occurredOn}T00:00:00Z`);
    if (
      Number.isNaN(dateCheck.getTime()) ||
      dateCheck.toISOString().slice(0, 10) !== raw.occurredOn
    ) {
      rowError("Date inexistante (jour hors mois)");
      continue;
    }

    const amountNum = parseAmountString(raw.amountRaw);
    if (amountNum === null || amountNum === 0) {
      rowError("Montant invalide (utilisez . ou , comme séparateur décimal, valeur non nulle)");
      continue;
    }

    if (raw.label.length === 0) {
      rowError("Libellé requis");
      continue;
    }
    if (raw.label.length > 120) {
      rowError(`Libellé trop long (${raw.label.length} > 120 caractères)`);
      continue;
    }

    if (raw.accountLabel.length === 0) {
      rowError("Nom de compte requis");
      continue;
    }

    const resolved = await deps.accountResolver.resolve(deps.userId, raw.accountLabel);
    if (resolved.matchCount === 0) {
      rowError("Compte introuvable");
      continue;
    }
    if (resolved.matchCount > 1) {
      rowError(`Compte ambigu (${resolved.matchCount} comptes portent ce nom)`);
      continue;
    }

    const type: TransactionType = amountNum > 0 ? "inflow" : "outflow";
    const category: TransactionCategory = "autre";
    rows.push({
      index: i,
      raw,
      parsed: {
        occurredOn: raw.occurredOn,
        amount: Math.abs(amountNum),
        type,
        category,
        label: raw.label,
        accountId: resolved.id!,
        isImprevu: false,
        notes: null,
      },
    });
    valid++;
  }

  return { rows, summary: { total: records.length, valid, invalid } };
}

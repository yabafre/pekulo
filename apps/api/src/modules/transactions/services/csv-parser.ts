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

    if (record.length !== 4) {
      rowError(`expected 4 columns, got ${record.length}`);
      continue;
    }

    if (!ISO_DATE_REGEX.test(raw.occurredOn)) {
      rowError(`invalid date: "${raw.occurredOn}" (expected YYYY-MM-DD)`);
      continue;
    }
    const dateCheck = new Date(`${raw.occurredOn}T00:00:00Z`);
    if (
      Number.isNaN(dateCheck.getTime()) ||
      dateCheck.toISOString().slice(0, 10) !== raw.occurredOn
    ) {
      rowError(`invalid date: "${raw.occurredOn}" (day out of month)`);
      continue;
    }

    const amountNum = Number(raw.amountRaw);
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      rowError(`invalid amount: "${raw.amountRaw}" (must be a finite non-zero number)`);
      continue;
    }

    if (raw.label.length === 0) {
      rowError("label required");
      continue;
    }
    if (raw.label.length > 120) {
      rowError(`label > 120 characters (got ${raw.label.length})`);
      continue;
    }

    if (raw.accountLabel.length === 0) {
      rowError("account label required");
      continue;
    }

    const resolved = await deps.accountResolver.resolve(deps.userId, raw.accountLabel);
    if (resolved.matchCount === 0) {
      rowError(`account not found: ${raw.accountLabel}`);
      continue;
    }
    if (resolved.matchCount > 1) {
      rowError(`ambiguous account label: ${raw.accountLabel} (${resolved.matchCount} matches)`);
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

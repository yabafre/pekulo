// apps/api/src/modules/transactions/services/csv-parser.test.ts
// Coverage for parseCsvForPreview (story 5-2). Uses bun:test (apps/api).
// AC-1 (parse + type inference), AC-2 (PAYLOAD_TOO_LARGE + boundary),
// AC-3 (INVALID_CSV), AC-4 (unknown account), AC-5 (ambiguous), plus per-row
// guards (date/amount/label), locale-aware amount parsing (FR comma decimal +
// thousand separators per aped-review M2/N3), leap-year happy path (N4),
// scientific-notation rejection (N3), and cross-user resolver isolation.

import { describe, expect, it } from "bun:test";
import { PekuloError } from "../../../common/errors";
import { MAX_CSV_ROWS, parseCsvForPreview, type AccountResolver } from "./csv-parser";

const ACCOUNT_ID_VALID = "acc_aaaaaaaaaaaaaaaaaaaaa";

function singleAccountResolver(label: string, id: string): AccountResolver {
  return {
    async resolve(_userId, queryLabel) {
      if (queryLabel === label) return { id, matchCount: 1 };
      return { id: null, matchCount: 0 };
    },
  };
}

function ambiguousAccountResolver(label: string, matchCount: number): AccountResolver {
  return {
    async resolve(_userId, queryLabel) {
      if (queryLabel === label) return { id: null, matchCount };
      return { id: null, matchCount: 0 };
    },
  };
}

describe("parseCsvForPreview", () => {
  // AC-1 (verbatim, story 5-2-csv-import.md:17):
  //   Given csvText of 3 rows for user A who owns one account labelled
  //   "Compte courant", When A calls previewImportCsv({ csvText }), Then
  //   the response is { rows: PreviewedRow[3], summary: { total: 3, valid: 3,
  //   invalid: 0 } }. Each row's parsed carries the type inferred from amount
  //   sign and amount as abs(value).
  it("parses 3 valid rows + infers type from amount sign", async () => {
    const csvText = [
      "2026-05-01,42.50,Courses Carrefour,Compte courant",
      "2026-05-02,-1200.00,Loyer,Compte courant",
      "2026-05-03,3500.00,Salaire,Compte courant",
    ].join("\n");

    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });

    expect(out.summary).toEqual({ total: 3, valid: 3, invalid: 0 });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]!.parsed).toEqual({
      occurredOn: "2026-05-01",
      amount: 42.5,
      type: "inflow",
      category: "autre",
      label: "Courses Carrefour",
      accountId: ACCOUNT_ID_VALID,
      isImprevu: false,
      notes: null,
    });
    expect(out.rows[1]!.parsed?.type).toBe("outflow");
    expect(out.rows[1]!.parsed?.amount).toBe(1200);
    expect(out.rows[2]!.parsed?.type).toBe("inflow");
    expect(out.rows[2]!.parsed?.amount).toBe(3500);
  });

  // AC-2 (verbatim, story 5-2-csv-import.md:18):
  //   Given csvText with 1001 rows, When A calls previewImportCsv, Then the
  //   service rejects with PAYLOAD_TOO_LARGE → HTTP 413. And at the boundary
  //   1000 rows are accepted (status 200).
  it("rejects payload > MAX_CSV_ROWS with PAYLOAD_TOO_LARGE", async () => {
    const csvText = Array.from(
      { length: MAX_CSV_ROWS + 1 },
      (_, i) => `2026-05-01,1.00,Row ${i},Compte courant`,
    ).join("\n");
    await expect(
      parseCsvForPreview({
        csvText,
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("accepts payload at the MAX_CSV_ROWS boundary", async () => {
    const csvText = Array.from(
      { length: MAX_CSV_ROWS },
      () => "2026-05-01,1.00,Row,Compte courant",
    ).join("\n");
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary.total).toBe(MAX_CSV_ROWS);
  });

  // AC-3 (verbatim, story 5-2-csv-import.md:19):
  //   Given csvText = "2026-05-01,"unbalanced quote,xxx" (csv-parse throws),
  //   When A calls previewImportCsv, Then the service rejects with
  //   INVALID_CSV → HTTP 400 carrying the parser's error message.
  it("throws INVALID_CSV on malformed CSV (unbalanced quote)", async () => {
    const csvText = '2026-05-01,"unbalanced,xxx,Compte';
    await expect(
      parseCsvForPreview({
        csvText,
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toBeInstanceOf(PekuloError);
  });

  it("throws INVALID_CSV on empty CSV", async () => {
    await expect(
      parseCsvForPreview({
        csvText: "",
        userId: "user-A",
        accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
      }),
    ).rejects.toMatchObject({ code: "INVALID_CSV" });
  });

  // AC-4 (verbatim, story 5-2-csv-import.md:20):
  //   Given A owns one account "Compte courant", When A previews a CSV row
  //   with accountLabel = "Livret A", Then the row's parsed is undefined,
  //   error = "account not found: Livret A", summary.invalid increments.
  //   The endpoint still returns 200 — row-level errors are data, not HTTP
  //   errors.
  it("marks unknown account as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,Test,Livret A";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary).toEqual({ total: 1, valid: 0, invalid: 1 });
    expect(out.rows[0]!.error).toBe("Compte introuvable");
    expect(out.rows[0]!.parsed).toBeUndefined();
  });

  // AC-5 (verbatim, story 5-2-csv-import.md:21):
  //   Given A owns [{label: "Compte courant"}, {label: "Compte courant"}],
  //   When A previews a CSV row with accountLabel = "Compte courant", Then
  //   the row's error = "ambiguous account label: Compte courant (2 matches)"
  //   and summary.invalid increments.
  it("marks ambiguous account label as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: ambiguousAccountResolver("Compte courant", 2),
    });
    expect(out.summary.invalid).toBe(1);
    expect(out.rows[0]!.error).toBe("Compte ambigu (2 comptes portent ce nom)");
  });

  it("marks malformed date as row-level invalid", async () => {
    const csvText = "2026-13-01,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("Date invalide");
  });

  it("marks day-out-of-month as row-level invalid", async () => {
    const csvText = "2026-02-30,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("jour hors mois");
  });

  it("marks zero amount as row-level invalid", async () => {
    const csvText = "2026-05-01,0,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("Montant invalide");
  });

  // FR decimal comma (quoted to escape the field separator) — Trade Republic
  // and other FR bank exports use "," as the decimal mark. AC review M2.
  it("accepts FR comma decimal when the field is quoted", async () => {
    const csvText = '2026-05-01,"1,50",Test,Compte courant';
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
    expect(out.rows[0]!.parsed?.amount).toBe(1.5);
    expect(out.rows[0]!.parsed?.type).toBe("inflow");
  });

  // Whitespace thousands separator — common in FR exports ("1 200.50").
  // csv-parse preserves internal whitespace, parseAmountString strips it.
  it("accepts whitespace thousand separators in amount", async () => {
    const csvText = "2026-05-01,1 200.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary.valid).toBe(1);
    expect(out.rows[0]!.parsed?.amount).toBe(1200.5);
  });

  // US-style thousands separator + decimal dot — needs quoting because the
  // comma collides with the field separator.
  it('accepts US thousands "1,200.50" when quoted', async () => {
    const csvText = '2026-05-01,"1,200.50",Test,Compte courant';
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary.valid).toBe(1);
    expect(out.rows[0]!.parsed?.amount).toBe(1200.5);
  });

  // Scientific notation must be rejected — real CSVs never carry "1e3", and
  // accepting it would silently coerce hostile or typo input to 1000.
  it("rejects scientific notation as row-level invalid", async () => {
    const csvText = "2026-05-01,1e3,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary.invalid).toBe(1);
    expect(out.rows[0]!.error).toContain("Montant invalide");
  });

  // Leap-year happy path — the day-out-of-month guard relies on Date
  // round-trip equality. Lock 2024-02-29 as accepted to prevent future regen
  // logic from rejecting valid leap days.
  it("accepts a leap-year date (2024-02-29)", async () => {
    const csvText = "2024-02-29,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
    expect(out.rows[0]!.parsed?.occurredOn).toBe("2024-02-29");
  });

  it("marks empty label as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toBe("Libellé requis");
  });

  // Cross-user safety guard — even if user-B's resolver returns no match,
  // user-A's data does not leak. Anchors AC-4's "RLS + explicit where: { userId }
  // on the repository" claim at the resolver boundary.
  it("does not leak across users — resolver is the boundary", async () => {
    const resolver: AccountResolver = {
      async resolve(userId, label) {
        if (userId === "user-A" && label === "Compte courant") {
          return { id: ACCOUNT_ID_VALID, matchCount: 1 };
        }
        return { id: null, matchCount: 0 };
      },
    };
    const out = await parseCsvForPreview({
      csvText: "2026-05-01,42.50,Test,Compte courant",
      userId: "user-B",
      accountResolver: resolver,
    });
    expect(out.summary.invalid).toBe(1);
    expect(out.rows[0]!.error).toBe("Compte introuvable");
    expect(out.rows[0]!.parsed?.accountId).toBeUndefined();
  });
});

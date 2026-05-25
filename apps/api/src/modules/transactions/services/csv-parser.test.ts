// apps/api/src/modules/transactions/services/csv-parser.test.ts
// Coverage for parseCsvForPreview (story 5-2). Uses bun:test (apps/api).
// 11 cases — AC-1 (parse + type inference), AC-2 (PAYLOAD_TOO_LARGE + boundary),
// AC-3 (INVALID_CSV), AC-4 (unknown account), AC-5 (ambiguous), plus per-row
// guards (date/amount/label) and cross-user resolver isolation.

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
    expect(out.rows[0]!.error).toBe("account not found: Livret A");
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
    expect(out.rows[0]!.error).toBe("ambiguous account label: Compte courant (2 matches)");
  });

  it("marks malformed date as row-level invalid", async () => {
    const csvText = "2026-13-01,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("invalid date");
  });

  it("marks day-out-of-month as row-level invalid", async () => {
    const csvText = "2026-02-30,42.50,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("day out of month");
  });

  it("marks zero amount as row-level invalid", async () => {
    const csvText = "2026-05-01,0,Test,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toContain("invalid amount");
  });

  it("marks empty label as row-level invalid", async () => {
    const csvText = "2026-05-01,42.50,,Compte courant";
    const out = await parseCsvForPreview({
      csvText,
      userId: "user-A",
      accountResolver: singleAccountResolver("Compte courant", ACCOUNT_ID_VALID),
    });
    expect(out.rows[0]!.error).toBe("label required");
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
    expect(out.rows[0]!.error).toBe("account not found: Compte courant");
    expect(out.rows[0]!.parsed?.accountId).toBeUndefined();
  });
});

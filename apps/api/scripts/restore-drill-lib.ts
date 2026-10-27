// restore-drill-lib.ts — pure predicates for restore-drill-check.ts.
// Kept separate from the CLI so the assertions can be unit-tested without a
// restored database (story 11-6 AC-1).

export interface NullUserIdRow {
  table: string;
  null_count: string | number;
}

export function evaluateNullUserIds(rows: readonly NullUserIdRow[]): string[] {
  return rows
    .filter((row) => Number(row.null_count) !== 0)
    .map((row) => `${row.table}: ${row.null_count} rows with NULL user_id`);
}

export function evaluateMigrationParity(committed: number, applied: number): string[] {
  if (committed === applied) return [];
  return [`migrations: ${committed} committed, ${applied} applied`];
}

export function evaluateAuthUsers(count: string | number): string[] {
  return Number(count) > 0 ? [] : ["auth.users is empty — the snapshot did not carry identities"];
}

export function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

// Contract-faithful fixtures for the mocked `@pekulo/contracts` clients.
//
// A hand-written `{ id }` mock hides output-shape drift: the real procedure
// returns a full DTO (`deleteAccount` → `{ ok, rowsDeleted, vaultSecretsPurged }`)
// and the screens read those fields. Every fixture below is passed through the
// procedure's REAL output schema, so a contract change fails the test that
// builds it instead of passing silently against an outdated mock.

interface ContractProcedure {
  "~orpc": {
    outputSchema?: {
      "~standard": {
        validate: (
          value: unknown,
        ) => { issues?: readonly { message: string }[] } | Promise<unknown>;
      };
    };
  };
}

type ContractModule = Record<string, unknown>;

/** Validate `value` against `contract[procedure]`'s output schema and return it. */
export function contractOutput<T>(contract: ContractModule, procedure: string, value: T): T {
  const proc = contract[procedure] as ContractProcedure | undefined;
  const schema = proc?.["~orpc"].outputSchema;
  if (!schema) throw new Error(`No output schema for procedure "${procedure}"`);
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) throw new Error(`"${procedure}" output validation is async`);
  const issues = (result as { issues?: readonly { message: string }[] }).issues;
  if (issues?.length) {
    throw new Error(
      `Fixture does not match "${procedure}" output: ${issues.map((i) => i.message).join("; ")}`,
    );
  }
  return value;
}

export const IDS = {
  user: "11111111-1111-4111-8111-111111111111",
  acc: "acc_AAAAAAAAAAAAAAAAAAAAA",
  tx: "tx_AAAAAAAAAAAAAAAAAAAAA",
  mst: "mst_AAAAAAAAAAAAAAAAAAAAA",
  hld: "hld_AAAAAAAAAAAAAAAAAAAAA",
  lot: "lot_AAAAAAAAAAAAAAAAAAAAA",
  re: "res_AAAAAAAAAAAAAAAAAAAAA",
  mtg: "resm_AAAAAAAAAAAAAAAAAAAAA",
  rnt: "resr_AAAAAAAAAAAAAAAAAAAAA",
  mon: "mr_AAAAAAAAAAAAAAAAAAAAA",
} as const;

const NOW = new Date("2026-11-20T00:00:00.000Z");

export const transactionDto = (over: Record<string, unknown> = {}) => ({
  id: IDS.tx,
  accountId: IDS.acc,
  occurredOn: "2026-11-20",
  label: "Courses",
  amount: 42.5,
  type: "outflow" as const,
  category: "courses" as const,
  isImprevu: false,
  notes: null,
  transferPairId: null,
  suggestedCategory: null,
  suggestedConfidence: null,
  suggestedRoute: null,
  suggestedAt: null,
  logoUrl: null,
  createdAt: "2026-11-20T00:00:00.000Z",
  ...over,
});

export const milestoneDto = () => ({
  id: IDS.mst,
  userId: IDS.user,
  targetCapital: 250000,
  targetYear: 2035,
  label: "250 k",
  position: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

export const accountDto = (over: Record<string, unknown> = {}) => ({
  id: IDS.acc,
  userId: IDS.user,
  label: "Livret A",
  type: "livret" as const,
  currency: "EUR",
  cashBalance: 1000,
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

export const holdingDto = () => ({
  id: IDS.hld,
  userId: IDS.user,
  accountId: IDS.acc,
  kind: "etf" as const,
  ticker: "CW8",
  isin: null,
  label: "Amundi MSCI World",
  currency: "EUR",
  quantity: 10,
  avgCost: 450,
  lastPrice: 500,
  lastPriceAt: null,
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  closedAt: null,
});

export const lotDto = () => ({
  id: IDS.lot,
  userId: IDS.user,
  holdingId: IDS.hld,
  type: "buy" as const,
  occurredOn: NOW,
  quantity: 2,
  priceUnit: 500,
  fees: 1,
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
});

export const propertyDto = () => ({
  id: IDS.re,
  userId: IDS.user,
  label: "Studio Lyon",
  propertyType: "locatif" as const,
  currentValuation: 150000,
  lastValuedOn: NOW,
  createdAt: NOW,
  updatedAt: NOW,
});

export const mortgageDto = () => ({
  id: IDS.mtg,
  userId: IDS.user,
  realEstateId: IDS.re,
  outstandingPrincipal: 120000,
  annualRate: 0.035,
  monthlyPayment: 650,
  termMonths: 240,
  startDate: NOW,
  createdAt: NOW,
  updatedAt: NOW,
});

export const rentalDto = () => ({
  id: IDS.rnt,
  userId: IDS.user,
  realEstateId: IDS.re,
  monthlyRent: 700,
  monthlyCharges: 80,
  furnished: true,
  createdAt: NOW,
  updatedAt: NOW,
});

export const monthlyRecordDto = (over: Record<string, unknown> = {}) => ({
  id: IDS.mon,
  year: 2026,
  monthNum: 11,
  incomeEur: 3400,
  spendingEur: 2100,
  transfersEur: 300,
  netChangeEur: 1000,
  signedOffAt: "2026-11-30T12:00:00.000Z",
  createdAt: "2026-11-30T12:00:00.000Z",
  ...over,
});

export const deleteAccountResult = () => ({
  ok: true as const,
  rowsDeleted: { transactions: 12, accounts: 2 },
  vaultSecretsPurged: 1,
});

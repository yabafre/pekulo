// packages/validators/src/advisory/advisory.snapshot.schemas.ts
// Deterministic advisory snapshot wire schema (story 12-2, ADR-0016 §3).
//
// The deterministic engine owns every number on this surface; this schema is
// the boundary between that engine (12-2) and the LLM layer (12-3). A field
// added here is a figure the LLM is allowed to cite, so the shape stays closed
// and explicit.
import { z } from "@pekulo/zod";
import { accountSchema } from "../accounts";
import { fxSourceSchema, holdingIdSchema, holdingSchema } from "../holdings";
import { propertyTypeSchema } from "../realestate";

export const ADVISORY_SNAPSHOT_SCHEMA_VERSION = 1;

export const ADVISORY_ALLOCATION_KEYS = ["cash", "investments", "real-estate"] as const;
export const advisoryAllocationKeySchema = z.enum(ADVISORY_ALLOCATION_KEYS);
export type AdvisoryAllocationKey = z.infer<typeof advisoryAllocationKeySchema>;

export const advisorySnapshotWealthSchema = z.object({
  totalEur: z.number().finite(),
  investableEur: z.number().finite(),
  cashEur: z.number().finite(),
  investmentsEur: z.number().finite(),
  realEstateEquityEur: z.number().finite(),
  unrealizedPnlEur: z.number().finite(),
});
export type AdvisorySnapshotWealth = z.infer<typeof advisorySnapshotWealthSchema>;

export const advisorySnapshotAllocationLineSchema = z.object({
  key: advisoryAllocationKeySchema,
  amountEur: z.number().finite(),
  pct: z.number().finite(),
});
export type AdvisorySnapshotAllocationLine = z.infer<typeof advisorySnapshotAllocationLineSchema>;

export const advisorySnapshotCompassSchema = z.object({
  targetEur: z.number().finite().positive(),
  currentWealthEur: z.number().finite().min(0),
  percent: z.number().finite().min(0),
  gapEur: z.number().finite(),
});
export type AdvisorySnapshotCompass = z.infer<typeof advisorySnapshotCompassSchema>;

export const advisorySnapshotMonthlyCashflowSchema = z.object({
  year: z.number().int().min(2020).max(2099),
  monthNum: z.number().int().min(1).max(12),
  incomeEur: z.number().finite().min(0),
  spendingEur: z.number().finite().min(0),
  transfersEur: z.number().finite().min(0),
  netChangeEur: z.number().finite(),
  source: z.enum(["derived", "persisted"]),
});
export type AdvisorySnapshotMonthlyCashflow = z.infer<typeof advisorySnapshotMonthlyCashflowSchema>;

export const advisorySnapshotPositionSchema = z.object({
  holdingId: holdingIdSchema,
  accountId: z.string().min(1),
  ticker: z.string().max(32).nullable(),
  label: z.string().min(1).max(120),
  kind: holdingSchema.shape.kind,
  currency: holdingSchema.shape.currency,
  quantity: z.number().finite().min(0),
  avgCost: z.number().finite().min(0),
  lastPrice: z.number().finite().min(0),
  marketValueEur: z.number().finite(),
  pnlEur: z.number().finite(),
  pnlPct: z.number().finite(),
});
export type AdvisorySnapshotPosition = z.infer<typeof advisorySnapshotPositionSchema>;

export const advisorySnapshotByKindSchema = z.object({
  kind: holdingSchema.shape.kind,
  marketValueEur: z.number().finite().min(0),
  pct: z.number().finite().min(0),
});
export type AdvisorySnapshotByKind = z.infer<typeof advisorySnapshotByKindSchema>;

export const advisorySnapshotPortfolioSchema = z.object({
  holdingsCount: z.number().int().positive(),
  investedEur: z.number().finite().min(0),
  marketValueEur: z.number().finite().min(0),
  pnlEur: z.number().finite(),
  byKind: z.array(advisorySnapshotByKindSchema).length(4),
  positions: z.array(advisorySnapshotPositionSchema),
});
export type AdvisorySnapshotPortfolio = z.infer<typeof advisorySnapshotPortfolioSchema>;

export const advisorySnapshotFiscalEnvelopeSchema = z.object({
  accountType: accountSchema.shape.type,
  amountEur: z.number().finite(),
  pct: z.number().finite(),
});
export type AdvisorySnapshotFiscalEnvelope = z.infer<typeof advisorySnapshotFiscalEnvelopeSchema>;

export const advisorySnapshotFiscalPropertySchema = z.object({
  propertyType: propertyTypeSchema,
  netEquityEur: z.number().finite(),
  pct: z.number().finite(),
});
export type AdvisorySnapshotFiscalProperty = z.infer<typeof advisorySnapshotFiscalPropertySchema>;

export const advisorySnapshotFiscaliteSchema = z.object({
  computation: z.literal("none"),
  envelopes: z.array(advisorySnapshotFiscalEnvelopeSchema),
  properties: z.array(advisorySnapshotFiscalPropertySchema),
  cryptoEur: z.number().finite().min(0),
});
export type AdvisorySnapshotFiscalite = z.infer<typeof advisorySnapshotFiscaliteSchema>;

export const advisorySnapshotFxSchema = z.object({
  base: z.literal("EUR"),
  source: fxSourceSchema,
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "asOf must be YYYY-MM-DD")
    .nullable(),
});
export type AdvisorySnapshotFx = z.infer<typeof advisorySnapshotFxSchema>;

export const advisorySnapshotSchema = z.object({
  schemaVersion: z.literal(ADVISORY_SNAPSHOT_SCHEMA_VERSION),
  baseCurrency: z.literal("EUR"),
  wealth: advisorySnapshotWealthSchema,
  allocation: z.array(advisorySnapshotAllocationLineSchema).length(3),
  compass: advisorySnapshotCompassSchema.nullable(),
  monthlyCashflow: advisorySnapshotMonthlyCashflowSchema,
  portfolio: advisorySnapshotPortfolioSchema.nullable(),
  fiscalite: advisorySnapshotFiscaliteSchema,
  fx: advisorySnapshotFxSchema,
});
export type AdvisorySnapshot = z.infer<typeof advisorySnapshotSchema>;

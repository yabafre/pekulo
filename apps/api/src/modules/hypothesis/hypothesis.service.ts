// apps/api/src/modules/hypothesis/hypothesis.service.ts
// Domain service for the hypothesis module. Owns:
// - get(userId): fetch the user's row or fall back to defaults (preserves
//   brownfield contract — the form ALWAYS gets a populated shape).
// - save(userId, input): upsert with ADR-0013 belt+suspenders (explicit
//   `where: { userId }` even though Prisma uses the service role).
// - dbToCamel + camelToDb conversions (relocated from apps/web/src/lib/actions/
//   hypotheses.ts during the 0-6 zapaction-orpc bridge port).

import type { ExtendedPrismaClient } from "../../database";
import { defaultHypotheses, type Hypotheses } from "@pekulo/validators";

export interface HypothesisService {
  get(userId: string): Promise<Hypotheses>;
  save(userId: string, input: Hypotheses): Promise<Hypotheses>;
}

/**
 * Coerce a Prisma-returned numeric column value to a JS number.
 * Postgres `Decimal` columns surface as `Prisma.Decimal` (decimal.js)
 * instances at runtime — we prefer `.toNumber()` over `Number(decimal)`
 * because it's explicit and lintable. Plain numbers pass through.
 * Unexpected types fall through to `Number(value)` as a last resort.
 * See `docs/lessons.md` L6 for the V1 tolerance budget — bounded by
 * Persona Alex's range; revisit before story 1-2's projection curve
 * lands (when values may exceed Number.MAX_SAFE_INTEGER).
 */
function decimalToNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

type HypothesisRow = {
  salaireNet: unknown;
  ticketRestoJour: unknown;
  partEmployeurTr: unknown;
  joursTravailles: unknown;
  navigoCout: unknown;
  partEmployeurNavigo: unknown;
  mutuelleEconomie: unknown;
  loyer: unknown;
  courses: unknown;
  transport: unknown;
  autresCharges: unknown;
  sorties: unknown;
  divers: unknown;
  voyageMois: unknown;
  creditMensuel: unknown;
  dateDebutCredit: unknown;
  matelasCible: unknown;
  perfEtfAnnuelle: unknown;
  augmentationSalaire: unknown;
  partEtfMonde: unknown;
  partOpportunites: unknown;
  economieRemoteMois: unknown;
  moisRemoteAn: unknown;
  revenuFreelanceMois: unknown;
  horizonYears: unknown;
  objectif: unknown;
};

function rowToHypotheses(row: HypothesisRow): Hypotheses {
  return {
    salaireNet: decimalToNumber(row.salaireNet, defaultHypotheses.salaireNet),
    ticketRestoJour: decimalToNumber(row.ticketRestoJour, defaultHypotheses.ticketRestoJour),
    partEmployeurTr: decimalToNumber(row.partEmployeurTr, defaultHypotheses.partEmployeurTr),
    joursTravailles: decimalToNumber(row.joursTravailles, defaultHypotheses.joursTravailles),
    navigoCout: decimalToNumber(row.navigoCout, defaultHypotheses.navigoCout),
    partEmployeurNavigo: decimalToNumber(
      row.partEmployeurNavigo,
      defaultHypotheses.partEmployeurNavigo,
    ),
    mutuelleEconomie: decimalToNumber(row.mutuelleEconomie, defaultHypotheses.mutuelleEconomie),
    loyer: decimalToNumber(row.loyer, defaultHypotheses.loyer),
    courses: decimalToNumber(row.courses, defaultHypotheses.courses),
    transport: decimalToNumber(row.transport, defaultHypotheses.transport),
    autresCharges: decimalToNumber(row.autresCharges, defaultHypotheses.autresCharges),
    sorties: decimalToNumber(row.sorties, defaultHypotheses.sorties),
    divers: decimalToNumber(row.divers, defaultHypotheses.divers),
    voyageMois: decimalToNumber(row.voyageMois, defaultHypotheses.voyageMois),
    creditMensuel: decimalToNumber(row.creditMensuel, defaultHypotheses.creditMensuel),
    dateDebutCredit: String(row.dateDebutCredit ?? defaultHypotheses.dateDebutCredit),
    matelasCible: decimalToNumber(row.matelasCible, defaultHypotheses.matelasCible),
    perfEtfAnnuelle: decimalToNumber(row.perfEtfAnnuelle, defaultHypotheses.perfEtfAnnuelle),
    augmentationSalaire: decimalToNumber(
      row.augmentationSalaire,
      defaultHypotheses.augmentationSalaire,
    ),
    partEtfMonde: decimalToNumber(row.partEtfMonde, defaultHypotheses.partEtfMonde),
    partOpportunites: decimalToNumber(row.partOpportunites, defaultHypotheses.partOpportunites),
    economieRemoteMois: decimalToNumber(
      row.economieRemoteMois,
      defaultHypotheses.economieRemoteMois,
    ),
    moisRemoteAn: decimalToNumber(row.moisRemoteAn, defaultHypotheses.moisRemoteAn),
    revenuFreelanceMois: decimalToNumber(
      row.revenuFreelanceMois,
      defaultHypotheses.revenuFreelanceMois,
    ),
    horizonYears: decimalToNumber(row.horizonYears, defaultHypotheses.horizonYears),
    objectif: decimalToNumber(row.objectif, defaultHypotheses.objectif),
  };
}

function hypothesesToWriteData(input: Hypotheses) {
  return {
    salaireNet: input.salaireNet,
    ticketRestoJour: input.ticketRestoJour,
    partEmployeurTr: input.partEmployeurTr,
    joursTravailles: input.joursTravailles,
    navigoCout: input.navigoCout,
    partEmployeurNavigo: input.partEmployeurNavigo,
    mutuelleEconomie: input.mutuelleEconomie,
    loyer: input.loyer,
    courses: input.courses,
    transport: input.transport,
    autresCharges: input.autresCharges,
    sorties: input.sorties,
    divers: input.divers,
    voyageMois: input.voyageMois,
    creditMensuel: input.creditMensuel,
    dateDebutCredit: input.dateDebutCredit,
    matelasCible: input.matelasCible,
    perfEtfAnnuelle: input.perfEtfAnnuelle,
    augmentationSalaire: input.augmentationSalaire,
    partEtfMonde: input.partEtfMonde,
    partOpportunites: input.partOpportunites,
    economieRemoteMois: input.economieRemoteMois,
    moisRemoteAn: input.moisRemoteAn,
    revenuFreelanceMois: input.revenuFreelanceMois,
    horizonYears: input.horizonYears,
    objectif: input.objectif,
  };
}

export function createHypothesisService(deps: { client: ExtendedPrismaClient }): HypothesisService {
  return {
    async get(userId) {
      const row = await deps.client.hypothesis.findUnique({ where: { userId } });
      if (!row) return defaultHypotheses;
      return rowToHypotheses(row as unknown as HypothesisRow);
    },
    async save(userId, input) {
      const writeData = hypothesesToWriteData(input);
      // The prefixedIds Prisma extension injects `id` at query time when
      // `data.id` is undefined (ADR-0012). Prisma's static type still
      // requires `id`, so the create branch is cast via `unknown` to keep
      // domain code free of `Prisma.*UncheckedCreateInput` plumbing.
      const row = await deps.client.hypothesis.upsert({
        where: { userId },
        update: writeData,
        create: { userId, ...writeData } as unknown as Parameters<
          typeof deps.client.hypothesis.upsert
        >[0]["create"],
      });
      return rowToHypotheses(row as unknown as HypothesisRow);
    },
  };
}

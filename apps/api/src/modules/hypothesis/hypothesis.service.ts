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
    salaireNet: Number(row.salaireNet ?? defaultHypotheses.salaireNet),
    ticketRestoJour: Number(row.ticketRestoJour ?? defaultHypotheses.ticketRestoJour),
    partEmployeurTr: Number(row.partEmployeurTr ?? defaultHypotheses.partEmployeurTr),
    joursTravailles: Number(row.joursTravailles ?? defaultHypotheses.joursTravailles),
    navigoCout: Number(row.navigoCout ?? defaultHypotheses.navigoCout),
    partEmployeurNavigo: Number(row.partEmployeurNavigo ?? defaultHypotheses.partEmployeurNavigo),
    mutuelleEconomie: Number(row.mutuelleEconomie ?? defaultHypotheses.mutuelleEconomie),
    loyer: Number(row.loyer ?? defaultHypotheses.loyer),
    courses: Number(row.courses ?? defaultHypotheses.courses),
    transport: Number(row.transport ?? defaultHypotheses.transport),
    autresCharges: Number(row.autresCharges ?? defaultHypotheses.autresCharges),
    sorties: Number(row.sorties ?? defaultHypotheses.sorties),
    divers: Number(row.divers ?? defaultHypotheses.divers),
    voyageMois: Number(row.voyageMois ?? defaultHypotheses.voyageMois),
    creditMensuel: Number(row.creditMensuel ?? defaultHypotheses.creditMensuel),
    dateDebutCredit: String(row.dateDebutCredit ?? defaultHypotheses.dateDebutCredit),
    matelasCible: Number(row.matelasCible ?? defaultHypotheses.matelasCible),
    perfEtfAnnuelle: Number(row.perfEtfAnnuelle ?? defaultHypotheses.perfEtfAnnuelle),
    augmentationSalaire: Number(row.augmentationSalaire ?? defaultHypotheses.augmentationSalaire),
    partEtfMonde: Number(row.partEtfMonde ?? defaultHypotheses.partEtfMonde),
    partOpportunites: Number(row.partOpportunites ?? defaultHypotheses.partOpportunites),
    economieRemoteMois: Number(row.economieRemoteMois ?? defaultHypotheses.economieRemoteMois),
    moisRemoteAn: Number(row.moisRemoteAn ?? defaultHypotheses.moisRemoteAn),
    revenuFreelanceMois: Number(row.revenuFreelanceMois ?? defaultHypotheses.revenuFreelanceMois),
    horizonYears: Number(row.horizonYears ?? defaultHypotheses.horizonYears),
    objectif: Number(row.objectif ?? defaultHypotheses.objectif),
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

export function createHypothesisService(deps: {
  client: ExtendedPrismaClient;
}): HypothesisService {
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

// apps/api/src/modules/logos/logos.repository.ts
// Story 6-10. Cache I/O over the two REFERENCE tables (no user_id — see
// logos.prisma). Both model names are in .oxlintrc.json `unscopedModels`, so
// the no-prisma-query-without-user-id rule does not fire here.
//
// Cache semantics: a row with logoUrl=null is a NEGATIVE cache entry ("resolved
// once, none found"); a missing row is "never attempted". Callers use
// `getMerchant`/`getProvider` returning `undefined` (no row) vs `{ logoUrl }`
// (row, possibly null) to tell them apart.

import type { ExtendedPrismaClient } from "../../database";

// Story 6-10 — `fetchedAt` is selected on reads so the service can honour the
// AC-5 refresh window (a stale row is re-resolved instead of served forever).
export interface LogosRepository {
  getMerchant(
    merchantKey: string,
  ): Promise<{ logoUrl: string | null; fetchedAt: Date } | undefined>;
  upsertMerchant(merchantKey: string, logoUrl: string | null): Promise<void>;
  getProvider(providerId: string): Promise<{ logoUrl: string | null; fetchedAt: Date } | undefined>;
  upsertProvider(providerId: string, logoUrl: string | null): Promise<void>;
}

export function createLogosRepository(deps: { client: ExtendedPrismaClient }): LogosRepository {
  return {
    async getMerchant(merchantKey) {
      const row = await deps.client.merchantLogoCache.findUnique({
        where: { merchantKey },
        select: { logoUrl: true, fetchedAt: true },
      });
      return row ?? undefined;
    },
    async upsertMerchant(merchantKey, logoUrl) {
      await deps.client.merchantLogoCache.upsert({
        where: { merchantKey },
        create: { merchantKey, logoUrl },
        update: { logoUrl, fetchedAt: new Date() },
      });
    },
    async getProvider(providerId) {
      const row = await deps.client.providerLogoCache.findUnique({
        where: { providerId },
        select: { logoUrl: true, fetchedAt: true },
      });
      return row ?? undefined;
    },
    async upsertProvider(providerId, logoUrl) {
      await deps.client.providerLogoCache.upsert({
        where: { providerId },
        create: { providerId, logoUrl },
        update: { logoUrl, fetchedAt: new Date() },
      });
    },
  };
}

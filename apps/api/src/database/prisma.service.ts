// prisma.service.ts — Prisma 7.8 client with PrismaPg driver adapter + extension chain.
//
// Per ADR-0012:
//   - Direct connection on port 5432 (apps/api is a long-running Bun process on Dokploy)
//   - PrismaPg adapter from @prisma/adapter-pg
//   - prefixed-ids extension as the only extension at V1 (a)
//
// The exported PrismaService is a wrapper around the extended Prisma client.
// Domain repositories in epics 1–8 import { PrismaService } and access the
// extended client via `service.client.<model>.<op>(...)`. The wrapper avoids
// mutating the Prisma `$extends` proxy with extra properties (fragile if Prisma
// ever freezes the proxy) and keeps `connect`/`disconnect` as explicit methods.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { prefixedIdsExtension } from "./prefixed-ids.extension";

function createExtendedClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const base = new PrismaClient({ adapter });
  return base.$extends(prefixedIdsExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

export interface PrismaService {
  readonly client: ExtendedPrismaClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export function createPrismaService(input: { databaseUrl: string }): PrismaService {
  const client = createExtendedClient(input.databaseUrl);
  return {
    client,
    connect: () => client.$connect(),
    disconnect: () => client.$disconnect(),
  };
}

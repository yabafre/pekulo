// prisma.service.ts — Prisma 7.8 client with PrismaPg driver adapter + extension chain.
//
// Per ADR-0012:
//   - Direct connection on port 5432 (apps/api is a long-running Bun process on Dokploy)
//   - PrismaPg adapter from @prisma/adapter-pg
//   - prefixed-ids extension as the only extension at V1 (a)
//
// The exported PrismaService type is the *extended* client returned by `$extends`.
// Domain repositories in epics 1–8 import this type and depend on the extended shape.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { prefixedIdsExtension } from "./prefixed-ids.extension";

function createExtendedClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const base = new PrismaClient({ adapter });
  return base.$extends(prefixedIdsExtension);
}

export type PrismaService = ReturnType<typeof createExtendedClient> & {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
};

export function createPrismaService(input: { databaseUrl: string }): PrismaService {
  const extended = createExtendedClient(input.databaseUrl);
  // The extended client exposes $connect / $disconnect on its inner symbol.
  // Wrap in connect/disconnect for ergonomic bootstrap usage.
  const service = extended as unknown as PrismaService;
  service.connect = () => (extended as unknown as { $connect: () => Promise<void> }).$connect();
  service.disconnect = () => (extended as unknown as { $disconnect: () => Promise<void> }).$disconnect();
  return service;
}

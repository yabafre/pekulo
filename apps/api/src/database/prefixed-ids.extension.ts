// prefixed-ids.extension.ts — Prisma extension wiring the pure injector.
//
// `query.$allModels.{create, createMany, createManyAndReturn, upsert}` is the
// minimum surface that produces new rows. `update`/`delete`/`findX` ops never
// generate IDs, so they pass through untouched. `upsert.create` is the implicit
// branch when no row matches `where`.
//
// Prisma generates a tight union of CreateInput types for `args.data`. The pure
// injector works on `Record<string, unknown>` so we cast through `unknown` at the
// boundary, then cast back on assignment.

import { Prisma } from "@generated/prisma/client";
import { injectPrefixedId } from "./prefixed-ids.injector";

type AnyData = Record<string, unknown>;

export const prefixedIdsExtension = Prisma.defineExtension({
  name: "pekulo-prefixed-ids",
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const data = args.data as unknown as AnyData;
        args.data = injectPrefixedId(model, data) as unknown as typeof args.data;
        return query(args);
      },
      async createMany({ model, args, query }) {
        const data = args.data as unknown as AnyData | AnyData[];
        if (Array.isArray(data)) {
          args.data = data.map((row) => injectPrefixedId(model, row)) as unknown as typeof args.data;
        } else {
          args.data = injectPrefixedId(model, data) as unknown as typeof args.data;
        }
        return query(args);
      },
      async createManyAndReturn({ model, args, query }) {
        const data = args.data as unknown as AnyData | AnyData[];
        if (Array.isArray(data)) {
          args.data = data.map((row) => injectPrefixedId(model, row)) as unknown as typeof args.data;
        } else {
          args.data = injectPrefixedId(model, data) as unknown as typeof args.data;
        }
        return query(args);
      },
      async upsert({ model, args, query }) {
        const create = args.create as unknown as AnyData;
        args.create = injectPrefixedId(model, create) as unknown as typeof args.create;
        return query(args);
      },
    },
  },
});

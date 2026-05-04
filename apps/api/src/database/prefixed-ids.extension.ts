// prefixed-ids.extension.ts — Prisma extension wiring the pure injector.
//
// `query.$allModels.{create, createMany, createManyAndReturn, upsert}` is the
// minimum surface that produces new rows. `update`/`delete`/`findX` ops never
// generate IDs, so they pass through untouched. `upsert.create` is the implicit
// branch when no row matches `where`; `upsert.update` is forbidden from
// carrying `id` (would clobber the PK on the matched row).
//
// The handler bodies live on the exported `prefixedIdsHandlers` object so the
// integration test can exercise them without instantiating a Prisma client.
// `prefixedIdsExtension` is the Prisma.defineExtension wrapper that wires those
// handlers into the `$extends` chain.

import { Prisma } from "@generated/prisma/client";
import { injectPrefixedId } from "./prefixed-ids.injector";

type AnyData = Record<string, unknown>;

interface QueryCtx<TArgs> {
  model: string;
  args: TArgs;
  query: (args: TArgs) => Promise<unknown>;
}

function ensureObject(model: string, op: string, value: unknown, index?: number): AnyData {
  if (typeof value !== "object" || value === null) {
    const where = index !== undefined ? `${op} row ${index}` : op;
    throw new TypeError(
      `[prefixed-ids] ${where} for model "${model}" is not an object (got ${value === null ? "null" : typeof value})`,
    );
  }
  return value as AnyData;
}

export const prefixedIdsHandlers = {
  async create({ model, args, query }: QueryCtx<{ data: unknown }>): Promise<unknown> {
    const data = ensureObject(model, "create", args.data);
    args.data = injectPrefixedId(model, data);
    return query(args);
  },
  async createMany({ model, args, query }: QueryCtx<{ data: unknown }>): Promise<unknown> {
    const data = args.data;
    if (Array.isArray(data)) {
      args.data = data.map((row, i) =>
        injectPrefixedId(model, ensureObject(model, "createMany", row, i)),
      );
    } else {
      args.data = injectPrefixedId(model, ensureObject(model, "createMany", data));
    }
    return query(args);
  },
  async createManyAndReturn({ model, args, query }: QueryCtx<{ data: unknown }>): Promise<unknown> {
    const data = args.data;
    if (Array.isArray(data)) {
      args.data = data.map((row, i) =>
        injectPrefixedId(model, ensureObject(model, "createManyAndReturn", row, i)),
      );
    } else {
      args.data = injectPrefixedId(model, ensureObject(model, "createManyAndReturn", data));
    }
    return query(args);
  },
  async upsert({
    model,
    args,
    query,
  }: QueryCtx<{ create: unknown; update: unknown }>): Promise<unknown> {
    const create = ensureObject(model, "upsert.create", args.create);
    // Reject any caller that tries to overwrite the PK via upsert.update —
    // PKs are immutable and must never be touched by the extension or by
    // domain code.
    const update = args.update;
    if (update !== null && typeof update === "object" && "id" in update) {
      throw new Error(
        `[prefixed-ids] upsert.update for model "${model}" must not contain id (PKs are immutable)`,
      );
    }
    args.create = injectPrefixedId(model, create);
    return query(args);
  },
};

export const prefixedIdsExtension = Prisma.defineExtension({
  name: "pekulo-prefixed-ids",
  query: {
    $allModels: {
      create: prefixedIdsHandlers.create as never,
      createMany: prefixedIdsHandlers.createMany as never,
      createManyAndReturn: prefixedIdsHandlers.createManyAndReturn as never,
      upsert: prefixedIdsHandlers.upsert as never,
    },
  },
});

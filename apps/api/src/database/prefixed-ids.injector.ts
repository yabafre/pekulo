// prefixed-ids.injector.ts — pure logic the Prisma extension delegates to.
//
// Given a Prisma model name and the `data` argument of a create/createMany/upsert
// op, this helper:
//   - returns `data` unchanged if `data.id` is already set (idempotence);
//   - throws MissingPrefixError if the model has no entry in ID_PREFIXES;
//   - otherwise returns a new object with id = `${prefix}_${base62(21)}`.
//
// The function is pure (no I/O, no Prisma import) — it is unit-testable without
// a database. The Prisma extension wrapper in `prefixed-ids.extension.ts` is the
// integration glue that calls this helper inside `query.$allModels.create` etc.

import { ID_PREFIXES, MissingPrefixError, type ModelName } from "./id-prefixes.config";
import { generateBase62Id } from "./base62";

export { MissingPrefixError };

export function injectPrefixedId<T extends { id?: unknown }>(model: string, data: T): T {
  if (data.id !== undefined && data.id !== null) {
    return data;
  }
  if (!(model in ID_PREFIXES)) {
    throw new MissingPrefixError(model);
  }
  const prefix = ID_PREFIXES[model as ModelName];
  return { ...data, id: `${prefix}_${generateBase62Id(21)}` };
}

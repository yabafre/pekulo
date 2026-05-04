# Sub-tree Versioning — `@pekulo/contracts`

Each module under `src/<module>.contract.ts` exports three symbols at the current major version `vN`:

- `<moduleKey>ContractVN` — frozen, never mutated after release. Wire-stable.
- `<moduleKey>Contract` — alias to the latest non-breaking version. The default consumer import.
- `<moduleKey>ContractMeta` — `{ moduleKey, mountPath, version }` literal. Drives the apps/api mount and the apps/web client.

## Bumping a sub-tree (breaking change)

When a wire-breaking change is required for a single module:

1. **Do not edit** the existing `<moduleKey>ContractV1`. Treat it as immutable.
2. Add the new shape at `<moduleKey>ContractV2` next to it (new `export const`).
3. Update `<moduleKey>Contract` to alias `<moduleKey>ContractV2` (current default).
4. Update `<moduleKey>ContractMeta.version` to `"v2"` and `mountPath` to `/rpc/v2/<moduleKey>`.
5. Keep `<moduleKey>ContractV1` exported from `index.ts` so older clients
   (web tier on a delayed deploy, mobile shipping a slightly older bundle)
   still resolve the previous tree.
6. On the apps/api side, mount BOTH versions: the new RPCHandler is keyed on
   `<moduleKey>ContractV2` (default) AND the old RPCHandler keyed on
   `<moduleKey>ContractV1` stays under `/rpc/v1/<moduleKey>` until traffic
   drains.
7. Document the bump in `docs/adr/<NNNN>-<module>-contract-v2.md` with the
   migration window.

## Bumping non-breaking (additive) changes

Add the new procedure to the existing `<moduleKey>ContractV1` directly. No
parallel version is needed. The wire is backward-compatible.

## What this is NOT

- Not for the top-level `PEKULO_CONTRACT_VERSION` — that bumps only on
  oRPC-runtime breaking changes (e.g. `@orpc/contract` major upgrade).
- Not a `package.json` semver bump trigger — `@pekulo/contracts` is a
  workspace package, version stays `0.0.0`.

See ADR-0009 (oRPC + Elysia) for the canonical mount layout.

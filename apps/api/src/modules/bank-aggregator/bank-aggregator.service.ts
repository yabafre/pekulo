// apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts
// Bank-aggregator domain service (story 5-6 + ADR-0015).
//
// Composition root: createBankAggregatorService injects repository + provider
// + transactionsService + accountsService + an optional clock seam (lesson
// 2026-05-27 — factory-level clock, no PEKULO_DEV_NOW_ISO env var).
//
// AC-1: completeConnection persists via Vault-encrypted token storage.
// AC-2: refreshConnection runs the dedup pre-flight inside importFromProvider.
// AC-5: SCA expiry (status_code=1010) flips status without retrying refresh.
// AC-6: refreshAll iterates per-user sequentially, swallows per-conn failure.
// AC-7: completeConnection auto-creates one Account per remote Bridge account.
// NFR-31: every method returns the DTO from the repository — token columns
//         are dropped at the boundary.

import type {
  BankConnection,
  BankProviderName,
  CompleteConnectionInput,
  InitiateConnectionInput,
  InitiateConnectionOutput,
  RefreshConnectionInput,
  RefreshConnectionOutput,
} from "@pekulo/validators";
import type { AccountService } from "../accounts/accounts.service";
import type { LogosService } from "../logos/logos.service";
import type {
  ProviderTransactionImportRow,
  TransactionsService,
} from "../transactions/transactions.service";
import {
  bankConnectionAlreadyExists,
  bankConnectionNotFound,
  bankConnectionRevoked,
  bankProviderUnavailable,
  bankScaRequired,
} from "./bank-aggregator.errors";
import type { BankProvider, ProviderBankAccount, ProviderTransaction } from "./bank-provider";
import type { BankAggregatorRepository } from "./bank-aggregator.repository";

export interface BankAggregatorService {
  initiateConnection(
    userId: string,
    userEmail: string,
    input: InitiateConnectionInput,
  ): Promise<InitiateConnectionOutput>;
  completeConnection(
    userId: string,
    userEmail: string,
    input: CompleteConnectionInput,
  ): Promise<BankConnection>;
  listConnections(userId: string): Promise<BankConnection[]>;
  refreshConnection(
    userId: string,
    input: RefreshConnectionInput,
  ): Promise<RefreshConnectionOutput>;
  refreshAll(): Promise<void>;
  handleWebhookEvent(event: unknown): Promise<void>;
  getReconnectUrl(userId: string, userEmail: string, connectionId: string): Promise<string>;
  renameConnection(
    userId: string,
    connectionId: string,
    displayName: string,
  ): Promise<BankConnection>;
  revokeConnection(userId: string, connectionId: string): Promise<{ ok: true }>;
  /**
   * Story 11-2 (FR-50 / AC-6) — erase the user at the bank provider, as the
   * first step of account deletion. Revokes each non-revoked item, then
   * deletes the provider user (the authoritative call: it removes the user and
   * every item beneath it).
   *
   * A per-item revoke failure is swallowed; a deleteUser failure PROPAGATES.
   * Account deletion is fail-closed on this method, so the distinction is
   * load-bearing — see the implementation comment for why.
   */
  eraseUserAtProvider(
    userId: string,
  ): Promise<{ itemsRevoked: number; providerUserDeleted: boolean }>;
  /**
   * Story 6-10 (FR-65) backfill — warm the logo caches for a user's already-
   * synced transactions (the refresh warm-up only covers each fresh batch).
   * Best-effort + idempotent (warmMany negative-caches misses). Returns the
   * attempted counts. No-op when no logos port is wired.
   */
  backfillUserLogos(userId: string): Promise<{ merchants: number; providers: number }>;
}

// Story 6-10 — cap distinct labels warmed per backfill run (bounds Brandfetch
// cost; a heavy account still fully warms across a few invocations).
const LOGO_BACKFILL_LABEL_LIMIT = 1000;

function mapBridgeAccountKind(kind: ProviderBankAccount["kind"]): "banque" | "livret" | "autre" {
  // Story 5-6 FEAT13 (2026-05-27). Mapping Bridge → Pekulo account_type:
  //   checking      → banque  (compte courant + Revolut Pocket)
  //   savings       → livret  (livret épargne)
  //   card / loan / other → autre  (dette ou type non reconnu)
  // The richer Bridge taxonomy (lifeinsurance, securities, pee, …) doesn't
  // surface through ProviderBankAccount.kind yet — only checking/savings/other
  // — because BridgeProvider.listAccounts narrows the type in bridge-client.ts.
  // Extending requires widening the kind union + adapting the bridge-client
  // map. Live-sandbox sees the 3-kind subset only.
  if (kind === "checking") return "banque";
  if (kind === "savings") return "livret";
  return "autre";
}

// Story 11-2 (FR-50 / NFR-7). Wall-clock ceiling on the per-item revoke pass
// inside eraseUserAtProvider. Each revokeItem is a token mint + a DELETE, up to
// 2 × BRIDGE_FETCH_TIMEOUT_MS on a degraded Bridge, and the loop runs once per
// connection — unbounded by itself. The revokes are a courtesy (deleteUser
// removes every item regardless), so past this budget the loop stops
// scheduling new ones and the erasure moves on. Added into the NFR-7 sum by
// settings.deletion-budget.test.ts.
export const ERASURE_REVOKE_BUDGET_MS = 6_000;

export function createBankAggregatorService(deps: {
  repository: BankAggregatorRepository;
  provider: BankProvider;
  transactionsService: TransactionsService;
  accountsService: AccountService;
  listAllActiveConnections: () => Promise<Array<{ userId: string; connectionId: string }>>;
  clock?: () => Date;
  /** Test seam for ERASURE_REVOKE_BUDGET_MS. */
  erasureRevokeBudgetMs?: number;
  // Story 6-10 (FR-65) — optional logo cache warm port (off the user hot path:
  // the cron/webhook refresh warm-up + the historical backfill). Best-effort.
  logos?: Pick<LogosService, "warmMany">;
}): BankAggregatorService {
  const now = () => (deps.clock ? deps.clock() : new Date());

  // Webhook anti-concurrency guard (audit 2026-06-12). The router now responds
  // 204 immediately and dispatches handleWebhookEvent in the background, so
  // Bridge no longer re-delivers on a slow refresh. But two genuine deliveries
  // for the SAME item (e.g. a retry that crossed a slow first attempt, or two
  // status events landing back to back) could still run refreshConnectionImpl
  // concurrently — duplicating the (up to 100-page × 10 s) fan-out and racing
  // the watermark. We coalesce per providerItemId: while one handler runs, a
  // second delivery for the same item awaits the in-flight promise instead of
  // starting its own. Keyed on providerItemId (the unit Bridge re-delivers) and
  // cleared in a finally so a failed run never wedges the item permanently.
  const inFlightByItem = new Map<string, Promise<void>>();

  // Story 11-2. Revokes each non-revoked item, sequentially (Bridge rate-limits
  // per user), until either the list or the wall-clock budget is exhausted.
  // Past the budget no NEW revoke is started; one in-flight call may finish in
  // the background and is ignored. Every failure is swallowed on purpose: this
  // pass is a courtesy — it flips each item's consent state at the bank before
  // the relationship ends — and it is the fragile half (Bridge mints a fresh
  // item_id on every connect, so a stale row can reference an item that no
  // longer exists and answer 404). Letting any of that abort the erasure would
  // block a GDPR deletion on a bookkeeping mismatch. deleteUser is what
  // guarantees the end state: it removes the Bridge user and every item
  // beneath it, reached or not.
  async function revokeItemsWithinBudget(
    userUuid: string,
    connections: Array<{ status: string; providerItemId: string }>,
    budgetMs: number,
  ): Promise<number> {
    let revoked = 0;
    let expired = false;
    const loop = (async () => {
      for (const connection of connections) {
        if (expired) return;
        if (connection.status === "revoked") continue;
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- sequential on purpose, bounded by the budget below
          await deps.provider.revokeItem({ userUuid, providerItemId: connection.providerItemId });
          if (!expired) revoked += 1;
        } catch {
          // see above
        }
      }
    })();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        expired = true;
        resolve();
      }, budgetMs);
    });
    await Promise.race([loop, deadline]);
    clearTimeout(timer);
    return revoked;
  }

  async function resolveAccountIds(
    userId: string,
    transactions: ProviderTransaction[],
  ): Promise<Map<string, string>> {
    // LOOKUP-ONLY map build — accounts are auto-created upstream now.
    //
    // Story 5-6 FIX12 (2026-05-27) made this lookup-only because the accounts
    // were created ONCE by completeConnection.listAccounts and a refresh never
    // re-read the item's account list — so an account opened AFTER the initial
    // connect was unknown here, its transactions were skipped, and the watermark
    // still advanced → permanent loss (audit bug #2).
    //
    // Fix #2(a) (2026-06-12): refreshConnectionImpl now re-pulls listAccounts and
    // find-or-creates every account BEFORE calling resolveAccountIds, so a newly
    // opened account is already present and nothing is skipped on the normal
    // path. This stays lookup-only on purpose: the FIX12 rationale (don't create
    // placeholder accounts from a volatile/orphan Bridge transaction account_id —
    // sandbox races produce transient ids that would never reconcile) still holds
    // as a defense-in-depth fallback. The remaining skip is now a true anomaly
    // path, and fix #2(b) guarantees the watermark never advances past a skipped
    // row (importedLatest is computed over imported rows only), so even an
    // anomalous skip is re-windowed on the next tick rather than lost.
    // Map the STABLE accountKey (set by the client from the item's accounts)
    // → local account id. Keyed on accountKey, not the volatile Bridge id, so
    // it matches the deduped local accounts (story 5-7 FIX 2026-05-28).
    const uniqueKeys = Array.from(new Set(transactions.map((t) => t.accountKey)));
    const map = new Map<string, string>();
    for (const key of uniqueKeys) {
      // oxlint-disable-next-line no-await-in-loop -- serial by design: small account-key resolution map build
      const account = await deps.accountsService.findByProviderKey(userId, "bridge", key);
      if (account) {
        map.set(key, account.id);
      } else {
        console.warn(
          `[bank-aggregator] transaction accountKey=${key} not in local accounts for user=${userId} — skipping ${transactions.filter((t) => t.accountKey === key).length} transaction(s)`,
        );
      }
    }
    return map;
  }

  // Story 5-6 FIX (post-smoke-test): Bridge v3 connect-sessions take
  // user_uuid (provider-side), not user_email. We persist the Pekulo userId ↔
  // bridge_user_uuid mapping in bridge_users so the create-user POST only
  // runs once per Pekulo user. The `_userEmail` argument is retained on the
  // signature for the future case where another provider may still rely on
  // email (Powens — TBD).
  async function resolveProviderUserUuid(userId: string): Promise<string> {
    const existing = await deps.repository.findProviderUserUuid(userId, "bridge");
    if (existing) return existing;
    const created = await deps.provider.createUser({ externalUserId: userId });
    try {
      await deps.repository.persistProviderUserUuid(userId, "bridge", created.providerUserUuid);
    } catch (err) {
      // Concurrent-init race: another request just inserted the row. Re-read
      // and trust the second-write fallback. If even the re-read returns
      // null, surface the original error.
      const retry = await deps.repository.findProviderUserUuid(userId, "bridge");
      if (!retry) throw err;
      return retry;
    }
    return created.providerUserUuid;
  }

  // Story 5-6 FIX (post-review aped-review): extract refreshConnection into a
  // named closure at factory scope so refreshAll / handleWebhookEvent call it
  // directly instead of via `this`. The plain-object-literal returned below
  // exposes `this` only when the caller invokes via `svc.refreshConnection()`
  // — destructuring (`const { refreshAll } = svc; refreshAll()`) would lose
  // the binding. Named closure keeps the cron + webhook paths binding-safe.
  async function refreshConnectionImpl(
    userId: string,
    input: RefreshConnectionInput,
  ): Promise<RefreshConnectionOutput> {
    const found = await deps.repository.findByIdForUser(userId, input.connectionId);
    if (!found) throw bankConnectionNotFound(input.connectionId);
    if (found.connection.status === "sca_required") throw bankScaRequired(input.connectionId);
    if (found.connection.status === "revoked") throw bankConnectionRevoked(input.connectionId);

    const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
    if (!userUuid) throw bankConnectionNotFound(input.connectionId);

    const providerItemId = found.connection.providerItemId;

    // Balance-refresh fix (2026-06-12) + lost-transaction fix #2(a): on EVERY
    // refresh (cron / webhook / reconnect), re-pull the item's account list
    // from the provider FIRST and find-or-create-or-update each account, BEFORE
    // resolving transactions. Two bugs this closes:
    //   1. accounts.cashBalance froze at the day-1 value — the refresh path
    //      never re-read balances (it only imported transactions). The
    //      find-or-create now patches the balance snapshot of existing rows.
    //   2. a NEW account opened on an EXISTING item produced orphan-keyed
    //      transactions that resolveAccountIds skipped (console.warn) while the
    //      watermark still advanced — permanent loss. Auto-creating the missing
    //      account here means resolveAccountIds finds it and nothing is skipped.
    const remoteAccounts = await deps.provider.listAccounts({ userUuid, providerItemId });
    for (const a of remoteAccounts) {
      // oxlint-disable-next-line no-await-in-loop -- serial by design: ordered find-or-create-or-update with P2002 race handling (mirrors completeConnection)
      await deps.accountsService.findOrCreateAutoFromProvider(userId, "bridge", a.accountKey, {
        label: `Bridge — ${a.bankName} — ${a.accountName}`,
        type: mapBridgeAccountKind(a.kind),
        currency: a.currency,
        cashBalance: a.balance,
        providerId: a.providerId,
      });
    }

    const since = found.connection.lastRefreshedAt
      ? new Date(found.connection.lastRefreshedAt)
      : null;

    // Truncation-completeness fix #3: Bridge paginates reverse-chronologically
    // by updated_at and a single listTransactions call is capped at MAX_PAGES.
    // When that cap truncates the window the client now reports
    // { truncated: true, oldestUpdatedAt }. We DRAIN the remaining (older) slice
    // within the tick by re-querying with `until = oldestUpdatedAt` until the
    // window is exhausted. The per-call page cap is preserved ("borne par tick"
    // — each HTTP fan-out stays ≤ MAX_PAGES); we just issue successive bounded
    // slices walking downward in time. `MAX_SLICES` is a belt-and-braces guard
    // against a pathological provider (it never trips on real finite history).
    const MAX_SLICES = 50; // ≤ MAX_SLICES × MAX_PAGES × 500 rows drained per tick.
    const allTransactions: ProviderTransaction[] = [];
    let until: Date | null = null;
    let drained = false;
    let slices = 0;
    while (slices < MAX_SLICES) {
      // oxlint-disable-next-line no-await-in-loop -- serial by design: each slice's `until` bound depends on the previous slice's oldestUpdatedAt
      const slice = await deps.provider.listTransactions({
        userUuid,
        providerItemId,
        since,
        until,
      });
      slices += 1;
      allTransactions.push(...slice.transactions);
      if (!slice.truncated) {
        drained = true;
        break;
      }
      // Truncated: resume below the oldest row reached this slice. Bridge's
      // `until` is a STRICT `updated_at < until`, so the next slice excludes the
      // floor row (no duplicate; any overlap dedups on providerTransactionId
      // anyway). If the provider reports no floor (no rows came back yet still
      // truncated — an anomaly) or the floor fails to strictly decrease (e.g.
      // ≥ PAGE_LIMIT×MAX_PAGES rows share one timestamp at a page boundary — a
      // pathological cluster), stop draining to avoid an infinite re-fetch loop.
      // The watermark stays put (see below) so the next tick re-windows from the
      // same `since` rather than stranding the un-drained tail.
      if (!slice.oldestUpdatedAt || (until && slice.oldestUpdatedAt >= until)) {
        break;
      }
      until = slice.oldestUpdatedAt;
    }

    const accountIdMap = await resolveAccountIds(userId, allTransactions);
    // Lost-transaction fix #2(b) — defense in depth: keep only the transactions
    // we can actually map to a local account; anything resolveAccountIds could
    // not resolve is dropped from the import AND from the watermark computation.
    const mappable = allTransactions.filter((t) => accountIdMap.has(t.accountKey));
    // The watermark must never advance past a row we failed to import, or that
    // row would never be re-windowed (permanent loss). Compute it over the
    // IMPORTED rows only — never the raw provider set.
    const importedLatest: Date | null = mappable.reduce<Date | null>(
      (max, t) => (!max || t.updatedAt > max ? t.updatedAt : max),
      null,
    );
    const rows: ProviderTransactionImportRow[] = mappable.map((t) => {
      const accountId = accountIdMap.get(t.accountKey)!;
      const type = t.amount >= 0 ? ("inflow" as const) : ("outflow" as const);
      return {
        accountId,
        occurredOn: t.occurredOn,
        label: t.label,
        amount: Math.abs(t.amount),
        type,
        category: "autre",
        providerTransactionId: t.providerTransactionId,
      };
    });

    const { persisted, skipped } = await deps.transactionsService.importFromProvider(
      userId,
      "bridge",
      rows,
    );

    // Quick-spec 2026-06-10 — the poll succeeded (provider replied + import ran),
    // so advance the USER-FACING "last synced" stamp to now() unconditionally,
    // even when Bridge returned 0 new rows. This is distinct from the
    // `last_refreshed_at` cursor below (which only moves on actual data): a
    // healthy connection with no new transactions must still read as freshly
    // synced, not frozen at the last transaction's date.
    await deps.repository.setLastSyncedAt(userId, input.connectionId, now());

    // Story 6-10 (FR-65) — warm the logo caches off the user hot path (this is
    // the cron/webhook refresh). Best-effort: a Brandfetch/Bridge failure must
    // never fail a refresh. Warm the distinct new merchant labels + the user's
    // distinct bank provider_ids (from the stored Account.providerId, so IBAN
    // and multi-institution connections all warm — not just the first txn's
    // card key). The read path only does cache lookups.
    if (deps.logos) {
      const logos = deps.logos;
      const labels = [...new Set(allTransactions.map((t) => t.label))];
      void (async () => {
        const providerIds = await deps.accountsService.listProviderIds(userId);
        await logos.warmMany({ labels, providerIds });
      })().catch(() => {
        /* best-effort cache warm-up; read path falls through to bank/category */
      });
    }

    // Watermark advance — combines three guarantees:
    //   * Story 5-6 post-review: only advance on actual data (an empty 200 on a
    //     non-first refresh leaves the stamp so the next tick re-queries).
    //   * Fix #2(b): advance to `importedLatest` (max over IMPORTED rows) rather
    //     than the raw provider latest, so a skipped row can never be stranded
    //     above the watermark.
    //   * Fix #3: only advance when the window was fully `drained` this tick. If
    //     truncation stopped us mid-drain, the stamp stays put so the next tick
    //     re-windows from the same `since` and resumes — no silent gap.
    let stampIso: string | null = found.connection.lastRefreshedAt;
    if (drained && importedLatest) {
      await deps.repository.setLastRefreshedAt(userId, input.connectionId, importedLatest);
      stampIso = importedLatest.toISOString();
    } else if (drained && allTransactions.length === 0 && !since) {
      // First-ever refresh that returned 0 transactions — stamp now() to
      // anchor the window. Subsequent empty responses will re-query the same
      // window forever otherwise.
      const anchor = now();
      await deps.repository.setLastRefreshedAt(userId, input.connectionId, anchor);
      stampIso = anchor.toISOString();
    }

    return {
      fetched: allTransactions.length,
      persisted,
      skipped,
      lastRefreshedAt: stampIso,
    };
  }

  // The actual webhook work, extracted so handleWebhookEvent can wrap it in the
  // per-item in-flight coalescing guard. Named closure at factory scope (same
  // rationale as refreshConnectionImpl — binding-safe across cron/webhook).
  async function handleWebhookWork(
    providerItemId: string,
    statusCode: number | undefined,
  ): Promise<void> {
    // Story 5-6 FIX (post-review): resolve the owning userId(s) FIRST via
    // findOwnersByProviderItemId — ADR-0013 mandates a userId-scoped guard
    // on every write. The cross-user setStatusByProviderItemId pattern
    // previously used was a defense-in-depth gap (a crafted HMAC-valid
    // payload could flip status across every user sharing the providerItemId).
    if (statusCode === 1010) {
      const owners = await deps.repository.findOwnersByProviderItemId("bridge", providerItemId);
      for (const o of owners) {
        // oxlint-disable-next-line no-await-in-loop -- serial by design: per-owner status write (userId-scoped, ADR-0013)
        await deps.repository.setStatus(o.userId, o.connectionId, "sca_required");
      }
      return;
    }
    if (statusCode === 0) {
      // Bridge scheduler refreshed the item — pull new transactions for
      // every owning user (in practice, exactly one).
      const owners = await deps.repository.findOwnersByProviderItemId("bridge", providerItemId);
      for (const o of owners) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- serial by design: per-owner refresh with error isolation
          await refreshConnectionImpl(o.userId, { connectionId: o.connectionId });
        } catch (err) {
          console.warn(
            `[bank-aggregator] webhook refresh skip ${o.connectionId}: ${
              err instanceof Error ? err.message : "unknown"
            }`,
          );
        }
      }
      return;
    }
    // Story 5-6 FIX (post-review): surface unknown Bridge status_codes
    // through pino so we can observe-and-decide instead of silently
    // dropping them. Bridge can send 1003 / 1004 / 1005 / etc. — V1
    // doesn't act on them, but invisible failure modes were a top-3 finding.
    console.warn(
      `[bank-aggregator] webhook item.refreshed unknown status_code=${
        statusCode ?? "<missing>"
      } for providerItemId=${providerItemId} — no action taken`,
    );
  }

  return {
    async initiateConnection(userId, userEmail, input) {
      const userUuid = await resolveProviderUserUuid(userId);
      const session = await deps.provider.createConnectSession({
        userUuid,
        userEmail,
        redirectUri: input.redirectUri,
      });
      return { connectUrl: session.connectUrl, sessionId: session.sessionId };
    },

    async completeConnection(userId, _userEmail, input) {
      // Bridge v3 stateful-widget model: the widget handed us a ready-to-use
      // item_id + user_uuid via the callback. We:
      //   1. Verify the user_uuid in the callback matches the bridge_users
      //      mapping for this Pekulo userId (defense — prevents a
      //      cross-user-attacker-supplies-someone-else's-item_id race).
      //   2. List the accounts for the item (user-Bearer minted internally).
      //   3. Auto-create local Account rows (AC-7).
      //   4. Persist BankConnection (tokens null — Bridge keeps them).
      const expectedUserUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
      if (!expectedUserUuid || expectedUserUuid !== input.userUuid) {
        throw bankConnectionNotFound(input.itemId);
      }

      const existing = await deps.repository.findByProviderItemId(userId, "bridge", input.itemId);
      if (existing) throw bankConnectionAlreadyExists(input.itemId);

      const remoteAccounts = await deps.provider.listAccounts({
        userUuid: input.userUuid,
        providerItemId: input.itemId,
      });

      // Already-synced guard (story 5-7 FIX 2026-05-28, revised 2026-06-10).
      // Bridge mints a NEW item every connect, so findByProviderItemId above
      // can't catch a re-connect of the same bank. The PREVIOUS guard rejected
      // whenever any account already existed locally (stable IBAN key) — but
      // that also blocked the legitimate revoke→reconnect flow, because revoke
      // soft-deletes the connection yet KEEPS its accounts, leaving them to
      // match forever ("la banque est déjà liée à Pekulo" on every reconnect).
      //
      // Correct discriminator: the Bridge institution `provider_id`. Reject only
      // when a NON-revoked connection already serves this institution (a genuine
      // active duplicate). When the only prior connection is revoked, its
      // orphaned accounts are simply re-used by findOrCreateAutoFromProvider
      // below (idempotent on the stable key) — the reconnect keeps the history.
      const institutionId = remoteAccounts.find((a) => a.providerId)?.providerId ?? null;
      if (institutionId) {
        const activeDuplicate = await deps.repository.findActiveByProviderId(
          userId,
          "bridge",
          institutionId,
        );
        if (activeDuplicate) throw bankConnectionAlreadyExists(input.itemId);
      }

      for (const a of remoteAccounts) {
        // oxlint-disable-next-line no-await-in-loop -- serial by design: ordered find-or-create with P2002 race handling
        await deps.accountsService.findOrCreateAutoFromProvider(userId, "bridge", a.accountKey, {
          label: `Bridge — ${a.bankName} — ${a.accountName}`,
          type: mapBridgeAccountKind(a.kind),
          currency: a.currency,
          cashBalance: a.balance,
          providerId: a.providerId,
        });
      }

      const created = await deps.repository.createConnection({
        userId,
        provider: "bridge" as BankProviderName,
        providerItemId: input.itemId,
        displayName: remoteAccounts[0]?.bankName ?? null,
        providerId: institutionId,
      });
      return created;
    },

    async listConnections(userId) {
      return deps.repository.listByUser(userId);
    },

    refreshConnection: refreshConnectionImpl,

    async refreshAll() {
      const all = await deps.listAllActiveConnections();
      for (const c of all) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- serial by design: per-user error isolation (AC-6 — one outage must not poison others)
          await refreshConnectionImpl(c.userId, { connectionId: c.connectionId });
        } catch (err) {
          // Non-fatal — one user's Bridge outage MUST NOT poison another
          // user's refresh. AC-6.
          console.warn(
            `[bank-aggregator] refreshAll skip ${c.connectionId}: ${
              err instanceof Error ? err.message : "unknown"
            }`,
          );
        }
      }
    },

    async handleWebhookEvent(event) {
      if (!event || typeof event !== "object") return;
      const evt = event as {
        type?: string;
        content?: { item_id?: number | string; status_code?: number };
      };
      if (evt.type !== "item.refreshed") return;
      const providerItemId =
        evt.content?.item_id !== undefined ? String(evt.content.item_id) : null;
      const statusCode = evt.content?.status_code;
      if (!providerItemId) return;

      // Anti-concurrency coalescing (audit 2026-06-12): if a handler for this
      // providerItemId is already running, await it instead of starting a second
      // concurrent run (which would duplicate the refresh fan-out and race the
      // watermark). The first delivery owns the work; later deliveries that
      // arrive while it runs piggy-back on the same promise.
      const inFlight = inFlightByItem.get(providerItemId);
      if (inFlight) {
        await inFlight;
        return;
      }

      const work = handleWebhookWork(providerItemId, statusCode);
      inFlightByItem.set(providerItemId, work);
      try {
        await work;
      } finally {
        // Clear only if we are still the owner — a later set() can't happen
        // because a second delivery coalesces above rather than overwriting.
        if (inFlightByItem.get(providerItemId) === work) {
          inFlightByItem.delete(providerItemId);
        }
      }
    },

    async getReconnectUrl(userId, userEmail, connectionId) {
      const found = await deps.repository.findByIdForUser(userId, connectionId);
      if (!found) throw bankConnectionNotFound(connectionId);
      const userUuid = await resolveProviderUserUuid(userId);
      const session = await deps.provider.createConnectSession({
        userUuid,
        userEmail,
        itemId: found.connection.providerItemId,
        forceReauthentication: false,
      });
      return session.connectUrl;
    },

    async renameConnection(userId, connectionId, displayName) {
      const updated = await deps.repository.setDisplayName(userId, connectionId, displayName);
      if (!updated) throw bankConnectionNotFound(connectionId);
      return updated.connection;
    },

    async revokeConnection(userId, connectionId) {
      const found = await deps.repository.findByIdForUser(userId, connectionId);
      if (!found) throw bankConnectionNotFound(connectionId);
      // Idempotent: a connection that is already 'revoked' needs no Bridge
      // call and no re-write — return ok so a double-confirm is harmless.
      if (found.connection.status !== "revoked") {
        const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
        if (userUuid) {
          try {
            await deps.provider.revokeItem({
              userUuid,
              providerItemId: found.connection.providerItemId,
            });
          } catch (err) {
            throw bankProviderUnavailable(err instanceof Error ? err.message : "revoke failed");
          }
        }
        await deps.repository.setStatus(userId, connectionId, "revoked");
      }
      return { ok: true as const };
    },

    async eraseUserAtProvider(userId) {
      const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
      // Never mapped to Bridge (no bank ever linked) — nothing to erase, and
      // the common case for a V1 account. Deletion proceeds with no provider
      // call at all, so fail-closed costs nothing on the normal path.
      if (!userUuid) return { itemsRevoked: 0, providerUserDeleted: false };

      const connections = await deps.repository.listByUser(userId);
      const itemsRevoked = await revokeItemsWithinBudget(
        userUuid,
        connections,
        deps.erasureRevokeBudgetMs ?? ERASURE_REVOKE_BUDGET_MS,
      );

      await deps.provider.deleteUser({ userUuid });
      return { itemsRevoked, providerUserDeleted: true };
    },

    async backfillUserLogos(userId) {
      if (!deps.logos) return { merchants: 0, providers: 0 };
      // Warm BOTH tiers for the user's history: distinct merchant labels AND the
      // distinct bank provider_ids (the original backfill warmed labels only, so
      // bank logos never populated for already-synced accounts — aped-review 6-10).
      const [labels, providerIds] = await Promise.all([
        deps.transactionsService.listDistinctProviderLabels(userId, LOGO_BACKFILL_LABEL_LIMIT),
        deps.accountsService.listProviderIds(userId),
      ]);
      return deps.logos.warmMany({ labels, providerIds });
    },
  };
}

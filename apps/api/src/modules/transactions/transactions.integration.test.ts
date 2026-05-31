// apps/api/src/modules/transactions/transactions.integration.test.ts
// oRPC HTTP boundary tests for story 5-1 (AC-11). Mirrors realestate.integration —
// boots a real Elysia app with mountOrpc, real RPCHandler, real jose HS256
// verifier, and the real transactions routes pointed at the real service +
// repository over an in-memory fake Prisma. AccountOwnershipProbe is a
// hand-mocked seam — the cross-aggregate guard lives in the service, the
// HTTP layer just translates.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import { extractRequestId } from "../../common/errors";
import type { PrismaService } from "../../database";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { createTransactionsModule } from "./transactions.module";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ACCOUNT_A = "acc_aaa111111111111111111";

async function signFor(userId: string): Promise<string> {
  return new SignJWT({ email: `${userId}@pekulo.local` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

// In-memory fake of the transaction table only. Sufficient because the
// accountId guard is delegated to the AccountOwnershipProbe seam below.
type Row = {
  id: string;
  userId: string;
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: { toNumber: () => number };
  type: "inflow" | "outflow";
  category: string;
  isImprevu: boolean;
  notes: string | null;
  transferPairId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const mintId = (prefix: string) =>
  `${prefix}_${Array.from(
    { length: 21 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join("")}`;

function makeFakeClient() {
  const rows: Row[] = [];
  // Monotonic clock for the fake — two consecutive `new Date()` calls can
  // land on the same millisecond, which makes (createdAt asc, id asc) FIFO
  // tests flaky because the random `mintId` then decides the tiebreak. The
  // counter bumps createdAt by 1 ms per insert so order-of-insertion is
  // strictly preserved.
  let monotonicMs = Date.now();
  const nextCreatedAt = () => new Date((monotonicMs += 1));
  // Story 5-2 — $transaction wrapper. Snapshot rows pre-callback, restore on
  // throw so the bulk-insert rollback assertion is honest (matches Prisma's
  // interactive-tx semantics). Explicit `: any` on $transaction breaks the
  // implicit-any cycle TS rejects on circular client ↔ $transaction refs;
  // the helper is test-only — no production type leak.
  const $transaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown> = async (cb) => {
    const snap = rows.map((r) => ({ ...r }));
    try {
      return await cb(client);
    } catch (err) {
      rows.length = 0;
      rows.push(...snap);
      throw err;
    }
  };
  const client = {
    $transaction,
    transaction: {
      create: async ({ data }: { data: Partial<Row> }) => {
        const row: Row = {
          id: data.id ?? mintId("tx"),
          userId: data.userId!,
          accountId: data.accountId!,
          occurredOn: data.occurredOn!,
          label: data.label!,
          amount: { toNumber: () => Number(data.amount) },
          type: data.type!,
          category: data.category!,
          isImprevu: data.isImprevu ?? false,
          notes: data.notes ?? null,
          transferPairId: data.transferPairId ?? null,
          createdAt: nextCreatedAt(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        rows.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where: {
          userId: string;
          accountId?: string | { not: string };
          type?: "inflow" | "outflow";
          occurredOn?: Date;
          amount?: number;
          category?: string;
          transferPairId?: string | null;
        };
        orderBy?:
          | Array<{ createdAt?: "asc" | "desc"; id?: "asc" | "desc"; occurredOn?: "asc" | "desc" }>
          | { createdAt?: "asc" | "desc"; id?: "asc" | "desc"; occurredOn?: "asc" | "desc" };
        take?: number;
      }) => {
        let out = rows.filter((r) => r.userId === where.userId);
        if (typeof where.accountId === "string") {
          out = out.filter((r) => r.accountId === where.accountId);
        } else if (where.accountId && "not" in where.accountId) {
          const excluded = where.accountId.not;
          out = out.filter((r) => r.accountId !== excluded);
        }
        if (where.type !== undefined) out = out.filter((r) => r.type === where.type);
        if (where.occurredOn !== undefined) {
          const target = where.occurredOn.getTime();
          out = out.filter((r) => r.occurredOn.getTime() === target);
        }
        if (where.amount !== undefined) {
          const target = where.amount;
          out = out.filter((r) => r.amount.toNumber() === target);
        }
        if (where.category !== undefined) out = out.filter((r) => r.category === where.category);
        if (where.transferPairId !== undefined)
          out = out.filter((r) => r.transferPairId === where.transferPairId);
        // Honor orderBy — pair detection asks (createdAt asc, id asc) for AC-5
        // FIFO, list reads ask (occurredOn desc, id desc). Default mirrors the
        // 5-1 list contract when orderBy is omitted.
        const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        if (clauses.length === 0) {
          out = [...out].sort(
            (a, b) => b.occurredOn.getTime() - a.occurredOn.getTime() || (a.id < b.id ? 1 : -1),
          );
        } else {
          out = [...out].sort((a, b) => {
            for (const c of clauses) {
              if (c.createdAt) {
                const av = (a.createdAt ?? new Date(0)).getTime();
                const bv = (b.createdAt ?? new Date(0)).getTime();
                const cmp = av - bv;
                if (cmp !== 0) return c.createdAt === "asc" ? cmp : -cmp;
              }
              if (c.occurredOn) {
                const cmp = a.occurredOn.getTime() - b.occurredOn.getTime();
                if (cmp !== 0) return c.occurredOn === "asc" ? cmp : -cmp;
              }
              if (c.id) {
                const cmp = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
                if (cmp !== 0) return c.id === "asc" ? cmp : -cmp;
              }
            }
            return 0;
          });
        }
        return take ? out.slice(0, take) : out;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          userId: string;
          id?: string | { in?: string[]; not?: string };
          transferPairId?: string;
        };
        data: Partial<Row> & { transferPairId?: string | null };
      }) => {
        let count = 0;
        for (const r of rows) {
          if (r.userId !== where.userId) continue;
          // id match supports legacy `where.id: string`, the 5-3 pair shape
          // `where.id: { in: [...] }`, and the unpair shape `where.id: { not }`.
          if (typeof where.id === "string") {
            if (r.id !== where.id) continue;
          } else if (where.id) {
            if (where.id.in !== undefined && !where.id.in.includes(r.id)) continue;
            if (where.id.not !== undefined && r.id === where.id.not) continue;
          }
          if (where.transferPairId !== undefined && r.transferPairId !== where.transferPairId)
            continue;
          if (data.amount !== undefined) r.amount = { toNumber: () => Number(data.amount) };
          if (data.label !== undefined) r.label = data.label;
          if (data.notes !== undefined) r.notes = data.notes;
          if (data.accountId !== undefined) r.accountId = data.accountId;
          if (data.category !== undefined) r.category = data.category;
          if (data.transferPairId !== undefined) r.transferPairId = data.transferPairId;
          r.updatedAt = new Date();
          count += 1;
        }
        return { count };
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          const r = rows[i]!;
          if (r.id === where.id && r.userId === where.userId) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      },
    },
  };
  return { rows, client };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";
let probeExists = true;
// Story 5-2 — control the resolver from each test scope. Default: not-found,
// the 5-1 tests don't exercise CSV import.
let resolverNextResult: { id: string | null; matchCount: number } = { id: null, matchCount: 0 };

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const fake = makeFakeClient();
  const mod = createTransactionsModule({
    prismaService: { client: fake.client } as unknown as PrismaService,
    accountOwnershipProbe: {
      exists: async () => probeExists,
      existsMany: async (_u, ids) => (probeExists ? new Set(ids) : new Set<string>()),
    },
    accountResolver: { resolve: async () => resolverNextResult },
  });
  const orpcRouter: PekuloRpcRouter = { transactions: mod.router };
  const app = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  await new Promise<void>((resolve) => {
    app.listen({ port: 0, hostname: "127.0.0.1" }, () => resolve());
  });
  const assignedPort = app.server?.port;
  if (!assignedPort) throw new Error("Elysia did not expose server.port");
  baseUrl = `http://127.0.0.1:${assignedPort}`;
  appHandle = {
    stop: async () => {
      await app.stop();
    },
  };
  // Warm-up — primes JIT for the 401 latency assertion.
  const warmup = await signFor(USER_A);
  await fetch(`${baseUrl}/rpc/v1/transactions/listTransactions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${warmup}` },
    body: JSON.stringify({ json: {} }),
  }).catch(() => undefined);
});

afterAll(async () => {
  await appHandle?.stop();
  appHandle = undefined;
});

async function call(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/rpc/v1/transactions/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ json: body }),
  });
}

const sampleCreate = (over: Record<string, unknown> = {}) => ({
  accountId: ACCOUNT_A,
  occurredOn: "2026-05-15",
  label: "Courses",
  amount: 87.5,
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  ...over,
});

// AC-11 (verbatim from story 5-1:27):
//   POST /rpc/v1/transactions/{createTransaction, updateTransaction,
//   deleteTransaction, getTransaction, listTransactions} with a valid body →
//   HTTP 200. Missing JWT → 401 within 100 ms (NFR-9). Cross-user → 404
//   TRANSACTION_NOT_FOUND. Invalid input → 400.
describe("transactions HTTP boundary (AC-11)", () => {
  test("AC-11/NFR-9 — missing JWT → 401 within 100 ms", async () => {
    const t0 = performance.now();
    const res = await call("createTransaction", sampleCreate());
    const elapsed = performance.now() - t0;
    expect(res.status).toBe(401);
    expect(elapsed).toBeLessThan(100);
  });

  test("AC-1/AC-11 — createTransaction → 200 + prefixed tx_ id", async () => {
    probeExists = true;
    const token = await signFor(USER_A);
    const res = await call("createTransaction", sampleCreate(), token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { id: string; amount: number } };
    expect(body.json.id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
    expect(body.json.amount).toBe(87.5);
  });

  test("AC-2/AC-11 — createTransaction with non-owned account → 404 ACCOUNT_NOT_FOUND", async () => {
    probeExists = false;
    const token = await signFor(USER_A);
    const res = await call("createTransaction", sampleCreate(), token);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { json: { code: string } };
    expect(body.json.code).toBe("ACCOUNT_NOT_FOUND");
    probeExists = true;
  });

  test("AC-12/AC-11 — invalid input (negative amount) → 400 from Zod", async () => {
    const token = await signFor(USER_A);
    const res = await call("createTransaction", sampleCreate({ amount: -1 }), token);
    expect(res.status).toBe(400);
  });

  test("AC-6/AC-11 — cross-user getTransaction → 404 TRANSACTION_NOT_FOUND", async () => {
    probeExists = true;
    const tokenA = await signFor(USER_A);
    const tokenB = await signFor(USER_B);
    const create = await call("createTransaction", sampleCreate(), tokenA);
    const { json } = (await create.json()) as { json: { id: string } };
    const cross = await call("getTransaction", { id: json.id }, tokenB);
    expect(cross.status).toBe(404);
    const body = (await cross.json()) as { json: { code: string } };
    expect(body.json.code).toBe("TRANSACTION_NOT_FOUND");
  });

  test("AC-4/AC-11 — deleteTransaction non-idempotent: 2nd delete → 404", async () => {
    probeExists = true;
    const token = await signFor(USER_A);
    const create = await call("createTransaction", sampleCreate(), token);
    const { json } = (await create.json()) as { json: { id: string } };
    const first = await call("deleteTransaction", { id: json.id }, token);
    expect(first.status).toBe(200);
    const second = await call("deleteTransaction", { id: json.id }, token);
    expect(second.status).toBe(404);
    const body = (await second.json()) as { json: { code: string } };
    expect(body.json.code).toBe("TRANSACTION_NOT_FOUND");
  });

  test("AC-5/AC-11 — listTransactions → 200 + items + nextCursor=null on small set", async () => {
    const token = await signFor(USER_A);
    const res = await call("listTransactions", { limit: 50 }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { items: unknown[]; nextCursor: string | null } };
    expect(Array.isArray(body.json.items)).toBe(true);
    expect(body.json.nextCursor).toBeNull();
  });

  test("AC-3/AC-11 — updateTransaction patch updates amount, leaves other fields", async () => {
    probeExists = true;
    const token = await signFor(USER_A);
    const create = await call(
      "createTransaction",
      sampleCreate({ amount: 50, category: "voyage" }),
      token,
    );
    const original = (
      (await create.json()) as {
        json: {
          id: string;
          accountId: string;
          occurredOn: string;
          label: string;
          type: string;
          category: string;
          isImprevu: boolean;
          notes: string | null;
        };
      }
    ).json;
    const res = await call("updateTransaction", { id: original.id, amount: 99 }, token);
    expect(res.status).toBe(200);
    const patched = (
      (await res.json()) as {
        json: {
          id: string;
          accountId: string;
          occurredOn: string;
          label: string;
          amount: number;
          type: string;
          category: string;
          isImprevu: boolean;
          notes: string | null;
        };
      }
    ).json;
    // AC-3: only amount + updated_at mutate; every other column stays equal.
    expect(patched.amount).toBe(99);
    expect(patched.id).toBe(original.id);
    expect(patched.accountId).toBe(original.accountId);
    expect(patched.occurredOn).toBe(original.occurredOn);
    expect(patched.label).toBe(original.label);
    expect(patched.type).toBe(original.type);
    expect(patched.category).toBe(original.category);
    expect(patched.isImprevu).toBe(original.isImprevu);
    expect(patched.notes).toBe(original.notes);
  });

  test("AC-3/AC-12 — updateTransaction empty patch → 400 from Zod refine", async () => {
    const token = await signFor(USER_A);
    const create = await call("createTransaction", sampleCreate(), token);
    const { json } = (await create.json()) as { json: { id: string } };
    const res = await call("updateTransaction", { id: json.id }, token);
    expect(res.status).toBe(400);
  });

  // Story 5-2 — oRPC HTTP boundary tests (AC-9 full status matrix).

  describe("POST /rpc/v1/transactions/preview-import-csv (story 5-2)", () => {
    test("returns 200 with row breakdown on valid CSV", async () => {
      const token = await signFor(USER_A);
      resolverNextResult = { id: ACCOUNT_A, matchCount: 1 };
      const res = await call(
        "previewImportCsv",
        { csvText: "2026-05-01,42.50,Test,Compte courant" },
        token,
      );
      expect(res.status).toBe(200);
      const { json } = (await res.json()) as {
        json: { summary: { total: number; valid: number; invalid: number } };
      };
      expect(json.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
    });

    test("returns 413 on payload > MAX_CSV_ROWS", async () => {
      const token = await signFor(USER_A);
      resolverNextResult = { id: ACCOUNT_A, matchCount: 1 };
      const csvText = Array.from({ length: 1001 }, () => "2026-05-01,1,Test,Compte courant").join(
        "\n",
      );
      const res = await call("previewImportCsv", { csvText }, token);
      expect(res.status).toBe(413);
    });

    test("returns 400 on malformed CSV", async () => {
      const token = await signFor(USER_A);
      resolverNextResult = { id: ACCOUNT_A, matchCount: 1 };
      const res = await call("previewImportCsv", { csvText: '2026-05-01,"unbalanced' }, token);
      expect(res.status).toBe(400);
    });
  });

  describe("POST /rpc/v1/transactions/import-csv (story 5-2)", () => {
    const sampleCsvRow = (over: Record<string, unknown> = {}) => ({
      occurredOn: "2026-05-01",
      amount: 42.5,
      type: "inflow" as const,
      category: "autre" as const,
      label: "Test",
      accountId: ACCOUNT_A,
      isImprevu: false,
      notes: null,
      ...over,
    });

    test("returns 200 + { ok: true, persisted: N } on success", async () => {
      const token = await signFor(USER_A);
      probeExists = true;
      const res = await call("importCsv", { rows: [sampleCsvRow()] }, token);
      expect(res.status).toBe(200);
      const { json } = (await res.json()) as { json: { ok: true; persisted: number } };
      expect(json).toEqual({ ok: true, persisted: 1 });
    });

    test("returns 404 ACCOUNT_NOT_FOUND when a row references another user's account", async () => {
      const token = await signFor(USER_B);
      probeExists = false;
      const res = await call("importCsv", { rows: [sampleCsvRow()] }, token);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { json: { code: string } };
      expect(body.json.code).toBe("ACCOUNT_NOT_FOUND");
    });

    test("returns 400 (Zod) on empty rows array", async () => {
      const token = await signFor(USER_A);
      probeExists = true;
      const res = await call("importCsv", { rows: [] }, token);
      expect(res.status).toBe(400);
    });

    // aped-review N5 — importCsv overflow boundary. The validator's
    // .max(1000) covers AC-7's upper-boundary claim ("Boundary verified at
    // 1 / 0 / 1000 / 1001"); locking it with an HTTP-level test prevents a
    // future schema relaxation from silently shipping a 1001-row payload.
    test("returns 400 (Zod) when rows length exceeds 1000", async () => {
      const token = await signFor(USER_A);
      probeExists = true;
      const rows = Array.from({ length: 1001 }, () => sampleCsvRow());
      const res = await call("importCsv", { rows }, token);
      expect(res.status).toBe(400);
    });
  });

  // ─── Story 5-3 — paired-create via oRPC ────────────────────────────────
  // AC-1 (verbatim from story 5-3-transfer-rule.md:17, excerpt):
  //   When A calls createTransaction({ accountId: "acc_bbb…", type: "inflow",
  //   amount: 120.00, occurredOn: "2026-05-20", category: "autre", … }),
  //   Then the service detects the pair, generates a fresh tp_<21-char-base62>
  //   id, and the repository updates BOTH rows so category=transfer,
  //   transferPairId=<the same tp_… id>.
  //
  // AC-9 (verbatim from story 5-3-transfer-rule.md:33, excerpt):
  //   the existing useActionMutation invalidates `transactionsTags.list()` —
  //   both updated rows surface in Récentes on the next paint. 5-3 introduces
  //   NO new tag, NO new SA, NO new hook.
  // (The tag-registry edge is web-tier and not exercised here ; the API-side
  //  contract this integration test pins is "creating an inflow that pairs
  //  with an existing outflow returns transfer + persists transfer on both".)
  describe("paired-create via oRPC (story 5-3)", () => {
    test("AC-1 + AC-9 — creating an inflow that pairs with an existing outflow returns transfer + pairs both rows", async () => {
      const token = await signFor(USER_A);
      probeExists = true;
      // Seed the fake DB with the outflow side via the SAME oRPC handler
      // — guarantees the row passes through prefixed-ids + DTO shape.
      const outRes = await call(
        "createTransaction",
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: "2026-05-20",
          label: "Virement épargne (out)",
          amount: 120,
          type: "outflow",
          category: "autre",
          isImprevu: false,
          notes: null,
        },
        token,
      );
      expect(outRes.status).toBe(200);
      const outBody = (await outRes.json()) as {
        json: { id: string; category: string; transferPairId: string | null };
      };
      expect(outBody.json.category).toBe("autre");
      expect(outBody.json.transferPairId).toBeNull();

      // Now the inflow on a different account — the rule should pair both.
      const inRes = await call(
        "createTransaction",
        {
          accountId: "acc_bbb222222222222222222",
          occurredOn: "2026-05-20",
          label: "Virement épargne (in)",
          amount: 120,
          type: "inflow",
          category: "autre",
          isImprevu: false,
          notes: null,
        },
        token,
      );
      expect(inRes.status).toBe(200);
      const inBody = (await inRes.json()) as {
        json: { id: string; category: string; transferPairId: string | null };
      };
      expect(inBody.json.category).toBe("transfer");
      expect(inBody.json.transferPairId).toMatch(/^tp_[0-9A-Za-z]{21}$/);

      // The previously-existing outflow row was also updated by pairAsTransfer.
      const outRe = await call("getTransaction", { id: outBody.json.id }, token);
      expect(outRe.status).toBe(200);
      const outReBody = (await outRe.json()) as {
        json: { category: string; transferPairId: string | null };
      };
      expect(outReBody.json.category).toBe("transfer");
      expect(outReBody.json.transferPairId).toBe(inBody.json.transferPairId);
    });

    // AC-5 (verbatim from story 5-3-transfer-rule.md:25):
    //   ONLY the OLDEST unpaired outflow (the one with createdAt = T1) is
    //   paired with the new inflow ; the T2 outflow stays category=autre,
    //   transferPairId=null. End-to-end at the HTTP boundary so a future
    //   regression on the orderBy direction surfaces here (the fake honors
    //   orderBy per aped-review's F4 fix).
    test("AC-5 — when 2 unpaired outflows match, the OLDEST pairs with the new inflow (FIFO)", async () => {
      const token = await signFor(USER_A);
      probeExists = true;
      const firstOut = await call(
        "createTransaction",
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: "2026-05-20",
          label: "First outflow",
          amount: 100,
          type: "outflow",
          category: "autre",
          isImprevu: false,
          notes: null,
        },
        token,
      );
      const firstOutBody = (await firstOut.json()) as { json: { id: string } };
      const secondOut = await call(
        "createTransaction",
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: "2026-05-20",
          label: "Second outflow",
          amount: 100,
          type: "outflow",
          category: "autre",
          isImprevu: false,
          notes: null,
        },
        token,
      );
      const secondOutBody = (await secondOut.json()) as { json: { id: string } };
      // Now the inflow — FIFO contract: the first (older) outflow gets paired.
      const inRes = await call(
        "createTransaction",
        {
          accountId: "acc_bbb222222222222222222",
          occurredOn: "2026-05-20",
          label: "Inflow",
          amount: 100,
          type: "inflow",
          category: "autre",
          isImprevu: false,
          notes: null,
        },
        token,
      );
      const inBody = (await inRes.json()) as {
        json: { category: string; transferPairId: string | null };
      };
      expect(inBody.json.category).toBe("transfer");
      const pairId = inBody.json.transferPairId;
      expect(pairId).toMatch(/^tp_[0-9A-Za-z]{21}$/);

      const firstReread = (await (
        await call("getTransaction", { id: firstOutBody.json.id }, token)
      ).json()) as { json: { category: string; transferPairId: string | null } };
      const secondReread = (await (
        await call("getTransaction", { id: secondOutBody.json.id }, token)
      ).json()) as { json: { category: string; transferPairId: string | null } };
      expect(firstReread.json.category).toBe("transfer");
      expect(firstReread.json.transferPairId).toBe(pairId);
      expect(secondReread.json.category).toBe("autre");
      expect(secondReread.json.transferPairId).toBeNull();
    });
  });
});

// AC-6 (verbatim from story 6-4:24):
//   Given the new confirmCategorisation / listPendingSuggestions endpoints,
//   When a request arrives without a valid session, Then it is rejected with
//   401 within the NFR-9 budget, and every query is scoped to the caller's own
//   data (where: { userId }, ADR-0013).
describe("confirmCategorisation HTTP boundary (6-4)", () => {
  test("AC-6 — missing JWT → 401", async () => {
    const res = await call("confirmCategorisation", {
      id: "tx_aaaaaaaaaaaaaaaaaaaaa",
      category: "courses",
    });
    expect(res.status).toBe(401);
  });

  test("AC-2/AC-6 — confirm on a stale/cross-user id → 404 TRANSACTION_NOT_FOUND", async () => {
    probeExists = true;
    const token = await signFor(USER_A);
    const res = await call(
      "confirmCategorisation",
      { id: mintId("tx"), category: "voyage" },
      token,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { json: { code: string } };
    expect(body.json.code).toBe("TRANSACTION_NOT_FOUND");
  });

  test("AC-1 — confirm own transaction → 200 + final category persisted", async () => {
    probeExists = true;
    const token = await signFor(USER_A);
    const created = (await (await call("createTransaction", sampleCreate(), token)).json()) as {
      json: { id: string };
    };
    const res = await call(
      "confirmCategorisation",
      { id: created.json.id, category: "voyage" },
      token,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { category: string } };
    expect(body.json.category).toBe("voyage");
  });
});

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
  return {
    rows,
    client: {
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
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          rows.push(row);
          return row;
        },
        findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
          rows.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
        findMany: async ({
          where,
          take,
        }: {
          where: { userId: string; accountId?: string };
          orderBy?: unknown;
          take?: number;
        }) => {
          let out = rows.filter((r) => r.userId === where.userId);
          if (where.accountId) out = out.filter((r) => r.accountId === where.accountId);
          out = [...out].sort(
            (a, b) => b.occurredOn.getTime() - a.occurredOn.getTime() || (a.id < b.id ? 1 : -1),
          );
          return take ? out.slice(0, take) : out;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; userId: string };
          data: Partial<Row>;
        }) => {
          let count = 0;
          for (const r of rows) {
            if (r.id === where.id && r.userId === where.userId) {
              if (data.amount !== undefined) r.amount = { toNumber: () => Number(data.amount) };
              if (data.label !== undefined) r.label = data.label;
              if (data.notes !== undefined) r.notes = data.notes;
              if (data.accountId !== undefined) r.accountId = data.accountId;
              r.updatedAt = new Date();
              count += 1;
            }
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
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";
let probeExists = true;

beforeAll(async () => {
  const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
  const fake = makeFakeClient();
  const mod = createTransactionsModule({
    prismaService: { client: fake.client } as unknown as PrismaService,
    accountOwnershipProbe: { exists: async () => probeExists },
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
  appHandle = { stop: async () => app.stop() };
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
    const create = await call("createTransaction", sampleCreate({ amount: 50 }), token);
    const { json } = (await create.json()) as { json: { id: string; label: string } };
    const res = await call("updateTransaction", { id: json.id, amount: 99 }, token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { amount: number; label: string } };
    expect(body.json.amount).toBe(99);
    expect(body.json.label).toBe("Courses");
  });

  test("AC-3/AC-12 — updateTransaction empty patch → 400 from Zod refine", async () => {
    const token = await signFor(USER_A);
    const create = await call("createTransaction", sampleCreate(), token);
    const { json } = (await create.json()) as { json: { id: string } };
    const res = await call("updateTransaction", { id: json.id }, token);
    expect(res.status).toBe(400);
  });
});

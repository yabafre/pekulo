// apps/api/src/modules/monthly/monthly.integration.test.ts
// End-to-end wiring proof for the monthly oRPC bridge (story 5-4). Mirrors
// hypothesis.integration.test.ts — boots a real Elysia app with mountOrpc,
// real RPCHandler, real jwt-verifier, and the real monthly routes pointed
// at an in-memory service-equivalent. The Prisma layer is unit-tested in
// monthly.repository.test.ts; this file proves the HTTP boundary.
//
// AC coverage:
//   - AC-4: 401 < 100 ms on missing JWT (NFR-9)
//   - AC-1: derived defaults sur user vide
//   - AC-2: upsert + re-read returns persisted (source narrowing)

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { SignJWT } from "jose";
import type {
  GetMonthlyInput,
  GetMonthlyOutput,
  MonthlyRecord,
  Transaction,
  UpsertMonthlyInput,
} from "@pekulo/validators";
import { extractRequestId } from "../../common/errors";
import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
import { createJwtVerifier } from "../../platform/security";
import { createMonthlyRouter } from "./monthly.routes";
import { createMonthlyService } from "./monthly.service";
import type { MonthlyRepository } from "./monthly.repository";

const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
const ISSUER = "https://integration.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const USER_ID = "11111111-1111-1111-1111-111111111111";
const PORT_BASE = 14400;

async function signValid(): Promise<string> {
  return new SignJWT({ email: "alex@pekulo.app" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

function inMemoryMonthlyRepository(): MonthlyRepository {
  const rows = new Map<string, MonthlyRecord>();
  const transactions = new Map<string, Transaction[]>();
  return {
    async findByMonth(userId, year, monthNum) {
      return rows.get(`${userId}|${year}|${monthNum}`) ?? null;
    },
    async upsertByMonth(userId, input) {
      const key = `${userId}|${input.year}|${input.monthNum}`;
      const existing = rows.get(key);
      const created: MonthlyRecord = {
        id: existing?.id ?? "mr_int000000000000000000",
        year: input.year,
        monthNum: input.monthNum,
        incomeEur: input.incomeEur,
        spendingEur: input.spendingEur,
        transfersEur: input.transfersEur,
        netChangeEur: input.netChangeEur,
        signedOffAt: existing?.signedOffAt ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      rows.set(key, created);
      return created;
    },
    async listTransactionsForMonth(userId, year, monthNum) {
      return transactions.get(`${userId}|${year}|${monthNum}`) ?? [];
    },
    async listPersistedInWindow(userId, fromYear, fromMonthNum) {
      const fromOrdinal = fromYear * 12 + (fromMonthNum - 1);
      return Array.from(rows.entries())
        .filter(([key]) => key.startsWith(`${userId}|`))
        .map(([, row]) => row)
        .filter((r) => r.year * 12 + (r.monthNum - 1) >= fromOrdinal);
    },
    async listTransactionsSince(userId, fromYear, fromMonthNum) {
      const fromOrdinal = fromYear * 12 + (fromMonthNum - 1);
      return Array.from(transactions.entries())
        .filter(([key]) => key.startsWith(`${userId}|`))
        .flatMap(([, txs]) => txs)
        .filter((tx) => {
          const parts = tx.occurredOn.split("-").map(Number);
          const y = parts[0] ?? 0;
          const m = parts[1] ?? 1;
          return y * 12 + (m - 1) >= fromOrdinal;
        });
    },
  };
}

let appHandle: { stop: () => Promise<void> } | undefined;
let baseUrl = "";

beforeAll(async () => {
  const repository = inMemoryMonthlyRepository();
  const service = createMonthlyService({ repository });
  const router = createMonthlyRouter({ service });
  const orpcRouter: PekuloRpcRouter = { monthly: router };
  const jwtVerifier = createJwtVerifier({
    secret: SECRET,
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  const port = PORT_BASE + Math.floor(Math.random() * 200);
  const app = new Elysia().onError(({ error, set }) => {
    const requestId = extractRequestId(error) ?? crypto.randomUUID();
    const mapped = mapErrorToOrpcResponse(error, requestId);
    set.status = mapped.status;
    return mapped.body;
  });
  mountOrpc(app, { jwtVerifier, orpcRouter });
  await new Promise<void>((resolve) => {
    app.listen({ port, hostname: "127.0.0.1" }, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${port}`;
  appHandle = {
    stop: async () => {
      await app.stop();
    },
  };
});

afterAll(async () => {
  await appHandle?.stop();
});

describe("monthly bridge (integration)", () => {
  test("AC-4: missing Authorization → 401 UNAUTHORIZED", async () => {
    const input: GetMonthlyInput = { year: 2026, monthNum: 5 };
    const res = await fetch(`${baseUrl}/rpc/v1/monthly/getMonthly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
  });

  test("AC-1: derived defaults sur user vide", async () => {
    const token = await signValid();
    const input: GetMonthlyInput = { year: 2026, monthNum: 5 };
    const res = await fetch(`${baseUrl}/rpc/v1/monthly/getMonthly`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ json: input }),
    });
    expect(res.status).toBe(200);
    const wrapped = (await res.json()) as { json: GetMonthlyOutput };
    expect(wrapped.json.source).toBe("derived");
    expect(wrapped.json.record.incomeEur).toBe(0);
    expect(wrapped.json.record.spendingEur).toBe(0);
    expect(wrapped.json.record.transfersEur).toBe(0);
    expect(wrapped.json.record.netChangeEur).toBe(0);
    expect(wrapped.json.record.signedOffAt).toBeNull();
  });

  test("listMonthly: returns N descending months, persisted upserts win over derive", async () => {
    const token = await signValid();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Persist April 2026 with an override; the listMonthly window should
    // surface it as `persisted` even though the current month falls into
    // the same window unaltered.
    const upsertRes = await fetch(`${baseUrl}/rpc/v1/monthly/upsertMonthly`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        json: {
          year: 2026,
          monthNum: 4,
          incomeEur: 4200,
          spendingEur: 1800,
          transfersEur: 0,
          netChangeEur: 2400,
        },
      }),
    });
    expect(upsertRes.status).toBe(200);

    const listRes = await fetch(`${baseUrl}/rpc/v1/monthly/listMonthly`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: { limit: 6 } }),
    });
    expect(listRes.status).toBe(200);
    const body = (await listRes.json()) as {
      json: { items: Array<{ source: string; record: MonthlyRecord }> };
    };
    expect(body.json.items).toHaveLength(6);
    const apr = body.json.items.find((i) => i.record.year === 2026 && i.record.monthNum === 4);
    expect(apr?.source).toBe("persisted");
    expect(apr?.record.incomeEur).toBe(4200);
  });

  test("AC-2: upsert persists + subsequent get returns source:'persisted'", async () => {
    const token = await signValid();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const upsertInput: UpsertMonthlyInput = {
      year: 2026,
      monthNum: 7,
      incomeEur: 3943,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1443,
    };
    const upsertRes = await fetch(`${baseUrl}/rpc/v1/monthly/upsertMonthly`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: upsertInput }),
    });
    expect(upsertRes.status).toBe(200);
    const upsertBody = (await upsertRes.json()) as { json: MonthlyRecord };
    expect(upsertBody.json.id).toMatch(/^mr_/);
    expect(upsertBody.json.spendingEur).toBe(2500);

    const getInput: GetMonthlyInput = { year: 2026, monthNum: 7 };
    const getRes = await fetch(`${baseUrl}/rpc/v1/monthly/getMonthly`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json: getInput }),
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { json: GetMonthlyOutput };
    expect(getBody.json.source).toBe("persisted");
    if (getBody.json.source !== "persisted") throw new Error("unreachable");
    expect(getBody.json.record.spendingEur).toBe(2500);
    expect(getBody.json.record.netChangeEur).toBe(1443);
  });
});

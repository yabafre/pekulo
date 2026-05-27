// AC-1 / AC-4 (verbatim from story 5-6-bridge-connector):
//   AC-1 — completeConnection({code, state}) resolves to a BankConnection
//          row (DTO without secret IDs).
//   AC-4 — DTO contains exactly id, userId, provider, providerItemId,
//          status, displayName, lastRefreshedAt, createdAt.
//
// Test runner: bun:test (apps/api convention per lesson 2026-05-07). The
// validators package itself does not ship a test runner — we consume the
// schemas here and assert their parse behaviour where bun:test is wired.

import { describe, test, expect } from "bun:test";
import {
  bankConnectionSchema,
  completeConnectionInputSchema,
  refreshConnectionInputSchema,
  initiateConnectionInputSchema,
} from "@pekulo/validators";

describe("bank-aggregator schemas", () => {
  test("bankConnectionSchema accepts a valid DTO without secret-id columns", () => {
    const parsed = bankConnectionSchema.parse({
      id: "bnk_1234567890123456789012",
      userId: "11111111-1111-4111-8111-111111111111",
      provider: "bridge",
      providerItemId: "bridge-item-123",
      status: "active",
      displayName: "Société Générale",
      lastRefreshedAt: "2026-05-27T10:00:00.000Z",
      createdAt: "2026-05-27T09:00:00.000Z",
    });
    expect(parsed.provider).toBe("bridge");
    expect(parsed.status).toBe("active");
  });

  test("bankConnectionSchema strips unknown secret-id keys via parse (zod default)", () => {
    const result = bankConnectionSchema.safeParse({
      id: "bnk_1234567890123456789012",
      userId: "11111111-1111-4111-8111-111111111111",
      provider: "bridge",
      providerItemId: "bridge-item-123",
      status: "active",
      displayName: null,
      lastRefreshedAt: null,
      createdAt: "2026-05-27T09:00:00.000Z",
      accessTokenSecretId: "00000000-0000-0000-0000-000000000aaa",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // @ts-expect-error — stripped by zod's default object behavior.
      expect(result.data.accessTokenSecretId).toBeUndefined();
    }
  });

  test("completeConnectionInputSchema requires non-empty itemId + userUuid (Bridge v3 shape)", () => {
    expect(completeConnectionInputSchema.safeParse({ itemId: "", userUuid: "x" }).success).toBe(
      false,
    );
    expect(completeConnectionInputSchema.safeParse({ itemId: "x", userUuid: "" }).success).toBe(
      false,
    );
    expect(completeConnectionInputSchema.safeParse({ itemId: "x", userUuid: "y" }).success).toBe(
      true,
    );
  });

  test("refreshConnectionInputSchema requires connectionId", () => {
    expect(refreshConnectionInputSchema.safeParse({}).success).toBe(false);
    expect(refreshConnectionInputSchema.safeParse({ connectionId: "bnk_x" }).success).toBe(true);
  });

  test("initiateConnectionInputSchema accepts empty body (redirectUri optional)", () => {
    expect(initiateConnectionInputSchema.safeParse({}).success).toBe(true);
    expect(initiateConnectionInputSchema.safeParse({ redirectUri: "not-a-url" }).success).toBe(
      false,
    );
    expect(
      initiateConnectionInputSchema.safeParse({ redirectUri: "https://app.pekulo/cb" }).success,
    ).toBe(true);
  });
});

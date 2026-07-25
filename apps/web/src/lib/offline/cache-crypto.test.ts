// AC-2 — "the payload is encrypted … no plaintext PII at rest in the browser"
// and "the stored CryptoKey reports extractable === false".
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "vitest";
import { KEYS_STORE, closeCacheDb, openCacheDb, purgeOfflineCache } from "./cache-db";
import {
  CACHE_KEY_ID,
  decryptJson,
  encryptJson,
  getCacheKey,
  getOrCreateCacheKey,
} from "./cache-crypto";

const SECRET = { account: "Livret A", balance: 18450.32, property: "Studio Lyon 7" };

beforeEach(async () => {
  await purgeOfflineCache();
});

describe("cache-crypto (story 9-2)", () => {
  test("AC-2 — the generated key is non-extractable", async () => {
    const db = await openCacheDb("user_alex");
    const key = await getOrCreateCacheKey(db);
    expect(key.extractable).toBe(false);
    expect(key.algorithm.name).toBe("AES-GCM");
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });

  test("the same key is reused across calls and survives a reopen", async () => {
    const db = await openCacheDb("user_alex");
    const first = await getOrCreateCacheKey(db);
    const second = await getOrCreateCacheKey(db);
    expect(second.extractable).toBe(false);
    await closeCacheDb();
    const reopened = await openCacheDb("user_alex");
    const stored = await getCacheKey(reopened);
    expect(stored).toBeDefined();
    // Proof it still decrypts what the first handle encrypted.
    const { iv, data } = await encryptJson(first, SECRET);
    await expect(decryptJson(stored as CryptoKey, iv, data)).resolves.toEqual(SECRET);
  });

  test("getCacheKey returns undefined before any key is minted", async () => {
    const db = await openCacheDb("user_fresh");
    expect(await getCacheKey(db)).toBeUndefined();
  });

  test("AC-2 — the ciphertext holds no plaintext PII", async () => {
    const db = await openCacheDb("user_alex");
    const key = await getOrCreateCacheKey(db);
    const { iv, data } = await encryptJson(key, SECRET);
    expect(iv).toHaveLength(12);
    const asText = new TextDecoder().decode(data);
    expect(asText).not.toContain("Livret A");
    expect(asText).not.toContain("18450");
    expect(asText).not.toContain("Studio Lyon 7");
    await expect(decryptJson(key, iv, data)).resolves.toEqual(SECRET);
  });

  test("a wrong key cannot decrypt the payload", async () => {
    const db = await openCacheDb("user_alex");
    const key = await getOrCreateCacheKey(db);
    const { iv, data } = await encryptJson(key, SECRET);
    const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await expect(decryptJson(other, iv, data)).rejects.toThrow();
  });

  test("the key is stored under the documented id", async () => {
    const db = await openCacheDb("user_alex");
    await getOrCreateCacheKey(db);
    expect(await db.get(KEYS_STORE, CACHE_KEY_ID)).toBeDefined();
  });
});

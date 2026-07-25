// apps/web/src/lib/offline/cache-crypto.ts
// AES-GCM envelope for the offline cache (ADR-0018, AC-2). The key is generated
// with `extractable: false`, so its raw material can never be read back by JS
// (`crypto.subtle.exportKey` rejects) nor by DevTools — while remaining usable
// for encrypt/decrypt and structured-cloneable into IndexedDB. It is NOT derived
// from the Supabase session: that cookie is httpOnly since story 11-7, and a
// server round-trip to obtain a key would make the cache unreadable in exactly
// the offline cold-start FR-54 is about.
import type { IDBPDatabase } from "idb";

export const CACHE_KEY_ID = "cache-key";
export const CACHE_ALGORITHM = "AES-GCM";
/** 96 bits — the IV length AES-GCM is specified for. */
export const IV_BYTES = 12;

type KeyStoreDb = Pick<IDBPDatabase<never>, never> & {
  get: (store: "keys", key: string) => Promise<unknown>;
  put: (store: "keys", value: CryptoKey, key: string) => Promise<unknown>;
};

/** Read the stored key, or undefined when this database has none yet. Used on
 * the restore path: minting a fresh key there would silently make an existing
 * snapshot undecryptable instead of surfacing it. */
export async function getCacheKey(db: KeyStoreDb): Promise<CryptoKey | undefined> {
  const stored = await db.get("keys", CACHE_KEY_ID);
  return (stored as CryptoKey | undefined) ?? undefined;
}

/** Read the stored key, generating and persisting one on first use. */
export async function getOrCreateCacheKey(db: KeyStoreDb): Promise<CryptoKey> {
  const existing = await getCacheKey(db);
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: CACHE_ALGORITHM, length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
  await db.put("keys", key, CACHE_KEY_ID);
  return key;
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const data = await crypto.subtle.encrypt({ name: CACHE_ALGORITHM, iv }, key, plaintext);
  return { iv, data };
}

export async function decryptJson<T>(
  key: CryptoKey,
  iv: Uint8Array,
  data: ArrayBuffer,
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt({ name: CACHE_ALGORITHM, iv }, key, data);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

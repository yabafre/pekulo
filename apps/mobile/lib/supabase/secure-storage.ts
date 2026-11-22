// apps/mobile/lib/supabase/secure-storage.ts
// Chunked expo-secure-store adapter for @supabase/supabase-js Auth.
// iOS Keychain / expo-secure-store enforces a 2048-byte limit per entry, while
// Supabase session JSON (access_token + refresh_token + user metadata) often
// exceeds 2 KB. Values larger than CHUNK_SIZE UTF-8 BYTES are split across
// `${key}__chunk_${id}_0..N-1` with a manifest `{"__chunked":true,"count":N,"id":"…"}`
// at `key`.
//
// Writes are crash-safe: the new generation of chunks (fresh `id`) is written
// first, the manifest swap is the single commit point, and the previous
// generation is deleted last. A kill at any point leaves either the old or the
// new session fully readable, never a mix of both. Manifests written before the
// `id` field existed (`__chunk_N` keys) are still read and purged.

import * as SecureStore from "expo-secure-store";

/** Max UTF-8 bytes per stored entry (the platform limit is 2048). */
export const CHUNK_SIZE = 1800;

export interface SecureStoreDriver {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

interface ChunkManifest {
  __chunked: true;
  count: number;
  /** Generation id; absent on manifests written by the first implementation. */
  id?: string;
}

function parseManifest(raw: string): ChunkManifest | null {
  if (!raw.startsWith('{"__chunked":true,')) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkManifest>;
    if (
      parsed["__chunked"] === true &&
      typeof parsed.count === "number" &&
      Number.isInteger(parsed.count) &&
      parsed.count > 0
    ) {
      const id = typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : undefined;
      return id
        ? { __chunked: true, count: parsed.count, id }
        : { __chunked: true, count: parsed.count };
    }
    return null;
  } catch {
    return null;
  }
}

function chunkKey(baseKey: string, index: number, id?: string): string {
  return id ? `${baseKey}__chunk_${id}_${index}` : `${baseKey}__chunk_${index}`;
}

function newGenerationId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Split on code-point boundaries so every chunk stays within `maxBytes` of
 * UTF-8 and no surrogate pair is cut in half. Joining the chunks restores the
 * input exactly.
 */
export function splitByUtf8Bytes(value: string, maxBytes: number = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of value) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (bytes + size > maxBytes) {
      chunks.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

export function createChunkedSecureStorage(driver: SecureStoreDriver = SecureStore) {
  async function readManifest(key: string): Promise<ChunkManifest | null> {
    const existing = await driver.getItemAsync(key);
    return existing ? parseManifest(existing) : null;
  }

  async function deleteChunks(key: string, manifest: ChunkManifest | null): Promise<void> {
    if (!manifest) return;
    await Promise.all(
      Array.from({ length: manifest.count }, (_, idx) =>
        driver.deleteItemAsync(chunkKey(key, idx, manifest.id)),
      ),
    );
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const raw = await driver.getItemAsync(key);
      if (raw === null) return null;
      const manifest = parseManifest(raw);
      if (!manifest) return raw;

      const parts = await Promise.all(
        Array.from({ length: manifest.count }, (_, idx) =>
          driver.getItemAsync(chunkKey(key, idx, manifest.id)),
        ),
      );
      if (parts.some((p) => p === null)) {
        return null;
      }
      return parts.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      const previous = await readManifest(key);
      const chunks = splitByUtf8Bytes(value);

      if (chunks.length <= 1) {
        await driver.setItemAsync(key, value);
        await deleteChunks(key, previous);
        return;
      }

      const id = newGenerationId();
      await Promise.all(
        chunks.map((chunk, idx) => driver.setItemAsync(chunkKey(key, idx, id), chunk)),
      );
      const manifest: ChunkManifest = { __chunked: true, count: chunks.length, id };
      await driver.setItemAsync(key, JSON.stringify(manifest));
      await deleteChunks(key, previous);
    },

    async removeItem(key: string): Promise<void> {
      const manifest = await readManifest(key);
      // Manifest first: from here on the session is unreadable even if a
      // chunk deletion below fails.
      await driver.deleteItemAsync(key);
      await deleteChunks(key, manifest);
    },
  };
}

export const chunkedSecureStorage = createChunkedSecureStorage();
